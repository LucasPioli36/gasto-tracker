'use client'

import { useActionState } from 'react'
import { addInvestmentPurchase, saveInitialBalance, type InvestmentActionState } from '@/actions/investments'

function Message({ state }: { state: InvestmentActionState }) {
  return state?.error ? <p role="alert" className="text-sm text-rose-400">{state.error}</p> : null
}

export function InitialBalanceForm({ invested, gain, date }: { invested: number; gain: number; date: string }) {
  const [state, action, pending] = useActionState(saveInitialBalance, null)
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-xs text-gray-400" htmlFor="initial_invested_usd">Capital invertido (USD)</label>
      <input id="initial_invested_usd" name="initial_invested_usd" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={invested.toFixed(2)} required className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
      <label className="text-xs text-gray-400" htmlFor="initial_gain_usd">Ganancia acumulada (USD)</label>
      <input id="initial_gain_usd" name="initial_gain_usd" type="number" inputMode="decimal" step="0.01" defaultValue={gain.toFixed(2)} required className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
      <label className="text-xs text-gray-400" htmlFor="initial_date">Fecha del saldo</label>
      <input id="initial_date" name="initial_date" type="date" defaultValue={date} required className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
      <Message state={state} />
      <button type="submit" disabled={pending} className="mt-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-gray-950 disabled:opacity-60">
        {pending ? 'Guardando…' : 'Guardar saldo inicial'}
      </button>
    </form>
  )
}

export function PurchaseForm({ date }: { date: string }) {
  const [state, action, pending] = useActionState(addInvestmentPurchase, null)
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="text-xs text-gray-400" htmlFor="amount_usd">Monto de la compra (USD)</label>
      <input id="amount_usd" name="amount_usd" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="500,00" required autoFocus className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
      <label className="text-xs text-gray-400" htmlFor="purchase_date">Fecha de compra</label>
      <input id="purchase_date" name="purchase_date" type="date" defaultValue={date} required className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-emerald-500" />
      <p className="text-xs leading-relaxed text-gray-500">La app usa el último precio diario de CSPX para calcular la compra. El resultado es estimado.</p>
      <Message state={state} />
      <button type="submit" disabled={pending} className="mt-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-gray-950 disabled:opacity-60">
        {pending ? 'Guardando…' : 'Guardar compra'}
      </button>
    </form>
  )
}
