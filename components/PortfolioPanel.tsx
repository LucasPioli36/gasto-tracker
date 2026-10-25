'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { InitialBalanceForm, PurchaseForm } from '@/components/InvestmentForms'
import { formatMontevideoDate, formatUSD } from '@/lib/investment-format'
import type { InvestmentPortfolio, InvestmentPurchase, InvestmentSnapshot } from '@/lib/investment-format'

type Props = {
  portfolio: InvestmentPortfolio | null
  purchases: InvestmentPurchase[]
  snapshots: InvestmentSnapshot[]
  latest: InvestmentSnapshot | null
  invested: number
  estimatedValue: number
  gain: number
  setupDate: string
}

function quoteTimestamp(value: string) {
  return `${value} · hora mostrada por Google`
}

function dayDifference(first: string, second: string) {
  const a = new Date(`${first}T00:00:00Z`).getTime()
  const b = new Date(`${second}T00:00:00Z`).getTime()
  return Math.round((a - b) / 86_400_000)
}

function PortfolioChart({
  portfolio, purchases, snapshots,
}: Pick<Props, 'portfolio' | 'purchases' | 'snapshots'>) {
  const [period, setPeriod] = useState<'1M' | 'Todo'>('1M')
  const series = useMemo(() => {
    if (!portfolio || !portfolio.units_initialized) return []
    const orderedPurchases = [...purchases].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))
    const allAddedUnits = orderedPurchases.reduce((sum, purchase) => sum + Number(purchase.units_added), 0)
    const initialUnits = Math.max(0, Number(portfolio.units_owned) - allAddedUnits)
    const rows = snapshots.map((snapshot) => {
      const datedPurchases = orderedPurchases.filter((purchase) => purchase.purchase_date <= snapshot.trading_date)
      const units = initialUnits + datedPurchases.reduce((sum, purchase) => sum + Number(purchase.units_added), 0)
      const cost = Number(portfolio.initial_invested_usd) + datedPurchases.reduce((sum, purchase) => sum + Number(purchase.amount_usd), 0)
      return { date: snapshot.trading_date, value: units * Number(snapshot.price_usd), invested: cost }
    })
    if (period === '1M' && rows.length) {
      const cutoff = new Date(`${rows[rows.length - 1].date}T00:00:00Z`)
      cutoff.setUTCDate(cutoff.getUTCDate() - 30)
      const monthRows = rows.filter((row) => new Date(`${row.date}T00:00:00Z`) >= cutoff)
      if (monthRows.length) return monthRows
    }
    return rows
  }, [period, portfolio, purchases, snapshots])

  if (series.length < 2) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl bg-gray-950/60 px-6 text-center text-xs text-gray-500">
        El gráfico va a mostrar la evolución después de registrar dos cotizaciones diarias.
      </div>
    )
  }

  const values = series.flatMap((row) => [row.value, row.invested])
  const min = Math.min(...values) * 0.985
  const max = Math.max(...values) * 1.015
  const point = (value: number, index: number) => {
    const x = 8 + (index / (series.length - 1)) * 324
    const y = 12 + ((max - value) / Math.max(max - min, 1)) * 112
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }
  const valuePath = series.map((row, index) => `${index ? 'L' : 'M'}${point(row.value, index)}`).join(' ')
  const investedPath = series.map((row, index) => `${index ? 'L' : 'M'}${point(row.invested, index)}`).join(' ')

  return (
    <>
      <div className="relative h-36 rounded-xl bg-gray-950/60 px-1 pt-1">
        <svg viewBox="0 0 340 136" className="h-full w-full" role="img" aria-label="Evolución estimada del valor de cartera y capital invertido">
          {[30, 72, 114].map((y) => <line key={y} x1="6" x2="334" y1={y} y2={y} stroke="#1f2937" strokeDasharray="3 5" />)}
          <path d={investedPath} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
          <path d={valuePath} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {series.map((row, index) => <circle key={row.date} cx={point(row.value, index).split(',')[0]} cy={point(row.value, index).split(',')[1]} r={index === series.length - 1 ? 4 : 2} fill="#34d399"><title>{`${formatMontevideoDate(row.date)} · ${formatUSD(row.value)}`}</title></circle>)}
        </svg>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-400" />Valor</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-500" />Invertido</span>
        </div>
        <div className="flex rounded-lg bg-gray-950 p-0.5 text-xs">
          {(['1M', 'Todo'] as const).map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-md px-2.5 py-1 ${period === value ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>{value}</button>)}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-600">
        <span>{formatMontevideoDate(series[0].date)}</span><span>{formatMontevideoDate(series[series.length - 1].date)}</span>
      </div>
    </>
  )
}

export default function PortfolioPanel(props: Props) {
  const [modal, setModal] = useState<'purchase' | null>(null)
  const { portfolio, purchases, latest, setupDate } = props
  const invested = portfolio ? props.invested : 9988
  const estimatedValue = portfolio ? props.estimatedValue : 10737
  const gain = portfolio ? props.gain : 749
  const gainPercent = invested > 0 ? gain / invested * 100 : 0
  const currentDate = setupDate
  const hasQuote = Boolean(latest && portfolio?.units_initialized)

  return (
    <div className="flex flex-col gap-4 pb-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Mi cartera</p>
          <h1 className="text-xl font-bold text-white">Inversiones</h1>
        </div>
        <span className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300">CSPX · USD</span>
      </div>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400">Valor total</span>
          <span aria-label="Ganancia acumulada sobre el capital invertido" className={`rounded-full px-2.5 py-1 text-[11px] ${gain >= 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
            {gain >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
          </span>
        </div>
        <p className="mt-2 text-4xl font-bold tracking-tight text-white">{formatUSD(estimatedValue)}</p>

        <div className="my-5 h-px bg-gray-800" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Invertido</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatUSD(invested)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Ganancia</p>
            <p className={`mt-1 text-lg font-semibold ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{gain >= 0 ? '+' : ''}{formatUSD(gain)}</p>
          </div>
        </div>
        <button type="button" disabled={!portfolio || !hasQuote} onClick={() => setModal('purchase')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-gray-950 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">
          <Plus size={17} /> Registrar compra
        </button>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Evolución</h2>
          <span className="text-[11px] text-gray-600">Estimación en USD</span>
        </div>
        <PortfolioChart portfolio={portfolio} purchases={purchases} snapshots={props.snapshots} />
      </section>

      {latest && (
        <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Precio CSPX · LSE</p>
              <p className="mt-0.5 text-base font-semibold text-white">{formatUSD(Number(latest.price_usd))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Última operación reportada</p>
              <p className="mt-0.5 text-xs text-gray-300">{quoteTimestamp(latest.trade_at)}</p>
            </div>
          </div>
          {dayDifference(setupDate, latest.trading_date) > 5 && <p className="mt-2 text-xs text-amber-400">La última cotización disponible tiene más de cinco días. Revisá la conexión con Google Sheets.</p>}
        </section>
      )}

      {!portfolio ? (
        <section className="rounded-2xl border border-emerald-900/70 bg-gray-900 p-5">
          <p className="text-sm font-semibold text-white">Cargá tu saldo inicial</p>
          <p className="mt-1 mb-4 text-xs leading-relaxed text-gray-400">Tomé los importes que pasaste: total US$10.737, invertido US$9.988 y ganancia US$749. Podés ajustarlos antes de guardar.</p>
          <InitialBalanceForm invested={9988} gain={749} date={currentDate} />
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Movimientos recientes</h2>
          {purchases.length ? <div className="flex flex-col gap-3">
            {purchases.slice(0, 4).map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between">
                <div><p className="text-sm text-white">Compra CSPX</p><p className="text-xs text-gray-500">{formatMontevideoDate(purchase.purchase_date)} · {formatUSD(Number(purchase.price_usd))} por unidad</p></div>
                <span className="text-sm font-medium text-white">{formatUSD(Number(purchase.amount_usd))}</span>
              </div>
            ))}
          </div> : <p className="text-sm text-gray-600">Todavía no hay compras registradas.</p>}
        </section>
      )}

      {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-0 sm:items-center sm:px-4" onClick={() => setModal(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="investment-modal-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-gray-800 bg-gray-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="investment-modal-title" className="text-lg font-semibold text-white">Registrar compra</h2>
            <button type="button" aria-label="Cerrar" onClick={() => setModal(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-800"><X size={18} /></button>
          </div>
          <PurchaseForm date={currentDate} />
        </section>
      </div>}
    </div>
  )
}
