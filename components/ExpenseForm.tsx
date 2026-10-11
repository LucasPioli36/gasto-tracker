'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { ExpenseFormState } from '@/actions/expenses'
import { CATEGORIES } from '@/lib/categories'
import { formatUYU } from '@/lib/format'
import { MAX_INSTALLMENTS, splitInstallments } from '@/lib/installments'

type Tipo = 'individual' | 'pareja'

export type ExpenseFormValues = {
  tipo: Tipo
  isIncome: boolean
  category: string
  amount: string
  description: string
  date: string
  paidBy?: string | null
}

type Props = {
  action: (state: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>
  initial: ExpenseFormValues
  mode: 'add' | 'edit'
  // Para "¿Quién pagó?" al editar un gasto de pareja.
  members?: { id: string; name: string }[]
  // Referencias usadas antes, para sugerir al escribir.
  suggestions?: string[]
}

export default function ExpenseForm({ action, initial, mode, members = [], suggestions = [] }: Props) {
  const [tipo, setTipo] = useState<Tipo>(initial.tipo)
  const [isIngreso, setIsIngreso] = useState(initial.isIncome)
  const [selectedCategory, setSelectedCategory] = useState(initial.category)
  const [amount, setAmount] = useState(initial.amount)
  const [description, setDescription] = useState(initial.description)
  const [date, setDate] = useState(initial.date)
  const [paidBy, setPaidBy] = useState(initial.paidBy ?? '')
  const [installments, setInstallments] = useState(1)
  const [state, formAction, pending] = useActionState(action, null)

  function handleTipoChange(t: boolean) {
    setIsIngreso(t)
    setSelectedCategory('')
  }

  const needsDescription = !isIngreso && selectedCategory === 'otros'
  const noun = isIngreso ? 'ingreso' : 'gasto'
  const backHref = tipo === 'pareja' ? '/pareja' : '/individual'
  // Cuotas: solo al agregar un gasto (al editar se edita una cuota suelta).
  const canSplit = mode === 'add' && !isIngreso
  const cuotas = canSplit && installments > 1 && Number(amount) > 0 && date
    ? splitInstallments(Number(amount), installments, date)
    : null

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="category" value={selectedCategory || (isIngreso ? 'otros' : '')} />
      <input type="hidden" name="is_income" value={isIngreso ? '1' : '0'} />
      {mode === 'edit' && tipo === 'pareja' && <input type="hidden" name="paid_by" value={paidBy} />}
      {canSplit && <input type="hidden" name="installments" value={installments} />}

      {/* Gasto / Ingreso switch */}
      <div>
        <p className="text-sm text-gray-400 mb-2 font-medium">Tipo</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTipoChange(false)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
              !isIngreso ? 'bg-rose-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            💸 Gasto
          </button>
          <button
            type="button"
            onClick={() => handleTipoChange(true)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
              isIngreso ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            💰 Ingreso
          </button>
        </div>
      </div>

      {/* Para quién */}
      <div>
        <p className="text-sm text-gray-400 mb-2 font-medium">¿Para quién?</p>
        <div className="flex gap-2">
          {(['individual', 'pareja'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors capitalize ${
                tipo === t ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              {t === 'individual' ? '👤 Yo' : '💑 Pareja'}
            </button>
          ))}
        </div>
        {!isIngreso && (
          <p className="text-xs text-gray-500 mt-2">Si es para la casa, cargalo solo en Pareja: igual cuenta en tu límite.</p>
        )}
      </div>

      {/* Quién pagó — solo al editar un gasto de pareja */}
      {mode === 'edit' && tipo === 'pareja' && members.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-medium">¿Quién pagó?</p>
          <div className="flex gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaidBy(m.id)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  paidBy === m.id ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount */}
      <div>
        <p className="text-sm text-gray-400 mb-2 font-medium">Monto</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            required
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-4 py-3.5 text-white text-xl font-semibold placeholder-gray-700 focus:outline-none focus:border-emerald-600 transition-colors"
          />
        </div>
      </div>

      {/* Cuotas */}
      {canSplit && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-medium">Cuotas</p>
          <div className="flex gap-2">
            {[1, 3, 6, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setInstallments(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  installments === n ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {n === 1 ? 'Contado' : n}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_INSTALLMENTS}
              step={1}
              aria-label="Otra cantidad de cuotas"
              placeholder="Otra"
              value={[1, 3, 6, 12].includes(installments) ? '' : installments}
              onChange={(e) => {
                const n = Math.trunc(Number(e.target.value))
                setInstallments(n >= 1 ? Math.min(n, MAX_INSTALLMENTS) : 1)
              }}
              className="w-16 bg-gray-900 border border-gray-800 rounded-xl px-2 text-center text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 text-sm"
            />
          </div>
          {cuotas && (
            <p className="text-xs text-gray-500 mt-2">
              {installments} cuotas de {formatUYU(cuotas[0].amount)} · una por mes desde el {formatDay(cuotas[0].date)} hasta el{' '}
              {formatDay(cuotas[cuotas.length - 1].date)}. Cada mes cuenta solo su cuota.
            </p>
          )}
        </div>
      )}

      {/* Category — solo para gastos */}
      {!isIngreso && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-medium">Categoría</p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCategory(id)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                  selectedCategory === id ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                <span className="text-2xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Referencia */}
      <div>
        <p className="text-sm text-gray-400 mb-2 font-medium">
          Referencia {needsDescription ? <span className="text-amber-400">(obligatoria en Otros)</span> : <span className="text-gray-600">(recomendada)</span>}
        </p>
        <input
          name="description"
          type="text"
          list="description-suggestions"
          required={needsDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isIngreso ? 'Ej: sueldo, freelance' : 'Ej: almuerzo con amigos'}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition-colors text-base"
        />
        <datalist id="description-suggestions">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        {!isIngreso && !description && !needsDescription && (
          <p className="text-xs text-gray-600 mt-2">Con una referencia después sabés qué fue y se detectan mejor los duplicados.</p>
        )}
      </div>

      {/* Fecha */}
      <div>
        <p className="text-sm text-gray-400 mb-2 font-medium">{installments > 1 && canSplit ? 'Fecha de la primera cuota' : 'Fecha'}</p>
        <input
          name="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-600 transition-colors text-base"
        />
      </div>

      {state?.error && (
        <p className="text-red-400 text-sm text-center bg-red-950/50 rounded-xl py-2.5 px-4">{state.error}</p>
      )}

      {state?.duplicate ? (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm text-amber-200">
            Ya cargaste {formatUYU(cuotas?.[0].amount ?? Number(amount))} ese día en {state.duplicate.scope === 'pareja' ? 'Pareja' : 'Yo'}
            {state.duplicate.description ? ` ("${state.duplicate.description}")` : ''}. ¿Es el mismo gasto?
          </p>
          <div className="flex gap-2">
            <Link href={backHref} className="flex-1 text-center bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl py-3">
              Sí, no lo guardes
            </Link>
            <button
              type="submit"
              name="confirm_duplicate"
              value="1"
              disabled={pending}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-3"
            >
              No, guardarlo igual
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending || (!isIngreso && !selectedCategory)}
          className={`${
            isIngreso ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
          } disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 text-base transition-colors mt-2`}
        >
          {pending ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : cuotas ? `Guardar ${installments} cuotas` : `Guardar ${noun}`}
        </button>
      )}
    </form>
  )
}

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: '2-digit' })
}
