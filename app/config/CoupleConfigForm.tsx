'use client'
import { useActionState } from 'react'
import { updateCoupleConfig } from '@/actions/config'

type Props = {
  monthlyBudget: number
}

export default function CoupleConfigForm({ monthlyBudget }: Props) {
  const [result, action, pending] = useActionState(updateCoupleConfig, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="text-sm text-gray-400 font-medium block mb-1.5">Presupuesto mensual conjunto</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            name="monthly_budget"
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            defaultValue={monthlyBudget}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-emerald-600 transition-colors text-base"
          />
        </div>
      </div>

      {result && typeof result === 'string' && (
        <p className="text-red-400 text-sm bg-red-950/50 rounded-xl py-2 px-3">{result}</p>
      )}
      {result === null && !pending && (
        <p className="text-emerald-400 text-sm">¡Guardado!</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
      >
        {pending ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  )
}
