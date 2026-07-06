'use client'
import { useActionState, useState } from 'react'
import { addDeposit } from '@/actions/expenses'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function DepositForm() {
  const [open, setOpen] = useState(false)
  const [error, action, pending] = useActionState(addDeposit, null)

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span className="font-medium">+ Registrar depósito</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <form action={action} className="px-4 pb-4 flex flex-col gap-3">
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            required
            placeholder="Monto en UYU"
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 text-base w-full"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {pending ? 'Guardando...' : 'Guardar depósito'}
          </button>
        </form>
      )}
    </div>
  )
}
