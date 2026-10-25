'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { todayInMontevideo } from '@/lib/investment-format'
import { requireInvestmentOwner } from '@/lib/investment-auth'

export type InvestmentActionState = { error?: string } | null

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > todayInMontevideo()) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function saveInitialBalance(_previous: InvestmentActionState, formData: FormData): Promise<InvestmentActionState> {
  const session = await requireInvestmentOwner()
  const invested = Number(formData.get('initial_invested_usd'))
  const gain = Number(formData.get('initial_gain_usd'))
  const date = String(formData.get('initial_date') ?? '')

  if (!Number.isFinite(invested) || invested < 0) return { error: 'Ingresá el capital invertido en USD.' }
  if (!Number.isFinite(gain) || invested + gain <= 0) return { error: 'El valor actual total tiene que ser mayor a cero.' }
  if (!validDate(date)) return { error: 'Elegí una fecha válida, hasta hoy.' }

  const { data: existing } = await db.from('investment_portfolios').select('user_id').eq('user_id', session.userId).maybeSingle()
  if (existing) return { error: 'El saldo inicial ya está cargado.' }

  const { data: latest } = await db.from('investment_price_snapshots').select('price_usd').order('trading_date', { ascending: false }).limit(1).maybeSingle()
  const price = latest ? Number(latest.price_usd) : 0
  const value = invested + gain
  const { error } = await db.from('investment_portfolios').insert({
    user_id: session.userId,
    initial_invested_usd: invested,
    initial_gain_usd: gain,
    initial_date: date,
    units_owned: price > 0 ? value / price : 0,
    units_initialized: price > 0,
  })
  if (error) return { error: 'No se pudo guardar el saldo inicial. Intentá de nuevo.' }

  revalidatePath('/inversiones')
  redirect('/inversiones')
}

export async function addInvestmentPurchase(_previous: InvestmentActionState, formData: FormData): Promise<InvestmentActionState> {
  const session = await requireInvestmentOwner()
  const amount = Number(formData.get('amount_usd'))
  const date = String(formData.get('purchase_date') ?? '')

  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Ingresá un monto mayor a cero.' }
  if (!validDate(date)) return { error: 'Elegí una fecha válida, hasta hoy.' }

  const { error } = await db.rpc('add_cspx_purchase', {
    p_user_id: session.userId,
    p_amount: amount,
    p_purchase_date: date,
  })
  if (error) return { error: 'No se pudo registrar la compra. Revisá que exista una cotización reciente de CSPX.' }

  revalidatePath('/inversiones')
  redirect('/inversiones')
}
