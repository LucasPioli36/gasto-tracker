import 'server-only'
import { db } from '@/lib/db'
import type { InvestmentPortfolio, InvestmentPurchase, InvestmentSnapshot } from '@/lib/investment-format'
export type { InvestmentPortfolio, InvestmentPurchase, InvestmentSnapshot } from '@/lib/investment-format'

export async function getInvestmentDashboard(userId: string) {
  const [portfolioResult, purchasesResult, snapshotsResult] = await Promise.all([
    db.from('investment_portfolios').select('*').eq('user_id', userId).maybeSingle(),
    db.from('investment_purchases').select('*').eq('user_id', userId).order('purchase_date', { ascending: false }).limit(1000),
    db.from('investment_price_snapshots').select('*').order('trading_date', { ascending: true }).limit(1000),
  ])

  const error = portfolioResult.error ?? purchasesResult.error ?? snapshotsResult.error
  if (error) throw new Error('No se pudieron cargar los datos de inversiones.')

  const portfolio = portfolioResult.data as InvestmentPortfolio | null
  const purchases = (purchasesResult.data ?? []) as InvestmentPurchase[]
  const snapshots = (snapshotsResult.data ?? []) as InvestmentSnapshot[]
  const latest = snapshots.at(-1) ?? null
  const invested = portfolio
    ? Number(portfolio.initial_invested_usd) + purchases.reduce((sum, purchase) => sum + Number(purchase.amount_usd), 0)
    : 0
  const estimatedValue = portfolio && latest && portfolio.units_initialized
    ? Number(portfolio.units_owned) * Number(latest.price_usd)
    : portfolio
      ? invested + Number(portfolio.initial_gain_usd)
      : 0
  const gain = estimatedValue - invested

  return { portfolio, purchases, snapshots, latest, invested, estimatedValue, gain }
}
