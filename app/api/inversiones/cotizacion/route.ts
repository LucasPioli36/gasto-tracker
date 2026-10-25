import { createHash, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { fetchCspxQuote } from '@/lib/google-sheets-quote'

export const maxDuration = 30

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || !supplied) return false
  const expectedHash = createHash('sha256').update(secret).digest()
  const suppliedHash = createHash('sha256').update(supplied).digest()
  return timingSafeEqual(expectedHash, suppliedHash)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'No autorizado.' }, { status: 401 })

  try {
    const quote = await fetchCspxQuote()
    const { error: snapshotError } = await db.from('investment_price_snapshots').upsert({
      symbol: 'LON:CSPX',
      price_usd: quote.price,
      trade_at: quote.tradeAt,
      trading_date: quote.tradingDate,
      source: 'google_sheets',
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'trading_date' })
    if (snapshotError) throw new Error('No se pudo guardar la cotización diaria.')

    const { data: portfolios, error: portfolioError } = await db.from('investment_portfolios')
      .select('user_id, initial_invested_usd, initial_gain_usd')
      .eq('units_initialized', false)
    if (portfolioError) throw new Error('No se pudieron inicializar los portafolios.')

    for (const portfolio of portfolios ?? []) {
      const units = (Number(portfolio.initial_invested_usd) + Number(portfolio.initial_gain_usd)) / quote.price
      const { error } = await db.from('investment_portfolios').update({
        units_owned: units,
        units_initialized: true,
        updated_at: new Date().toISOString(),
      }).eq('user_id', portfolio.user_id).eq('units_initialized', false)
      if (error) throw new Error('No se pudo inicializar el saldo con la primera cotización.')
    }

    return Response.json({ symbol: 'LON:CSPX', price: quote.price, tradeAt: quote.tradeAt, tradingDate: quote.tradingDate })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falló la sincronización de CSPX.'
    return Response.json({ error: message }, { status: 502 })
  }
}
