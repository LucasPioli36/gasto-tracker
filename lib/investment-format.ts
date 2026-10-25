export type InvestmentPortfolio = {
  user_id: string
  initial_invested_usd: number
  initial_gain_usd: number
  initial_date: string
  units_owned: number
  units_initialized: boolean
}

export type InvestmentPurchase = {
  id: string
  amount_usd: number
  purchase_date: string
  price_usd: number
  units_added: number
  created_at: string
}

export type InvestmentSnapshot = {
  id: string
  price_usd: number
  trade_at: string
  fetched_at: string
  trading_date: string
}

export function formatUSD(amount: number) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMontevideoDate(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}

export function todayInMontevideo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
