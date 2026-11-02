'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ExpenseFormState } from '@/actions/expenses'
import { CATEGORIES } from '@/lib/categories'
import { formatUYU } from '@/lib/format'
import { MAX_INSTALLMENTS, splitInstallments } from '@/lib/installments'
import { restoreExpenseRequestKey } from '@/lib/expense-drafts'

type Tipo = 'individual' | 'pareja'

function createRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

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
  draftKey?: string
}

export default function ExpenseForm({ action, initial, mode, members = [], draftKey }: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState<Tipo>(initial.tipo)
  const [isIngreso, setIsIngreso] = useState(initial.isIncome)
  const [selectedCategory, setSelectedCategory] = useState(initial.category)
  const [amount, setAmount] = useState(initial.amount)
  const [description, setDescription] = useState(initial.description)
  const [date, setDate] = useState(initial.date)
  const [paidBy, setPaidBy] = useState(initial.paidBy ?? '')
  const [installments, setInstallments] = useState(1)
  const [requestKey, setRequestKey] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null)
  const hydratedDraftKey = useRef<string | null>(null)
  const [state, formAction, pending] = useActionState(action, null)

  useEffect(() => {
    let active = true
    fetch('/api/expenses/suggestions', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) return
        const result: unknown = await response.json()
        if (!active || !result || typeof result !== 'object' || !('suggestions' in result)) return
        const values = result.suggestions
        if (Array.isArray(values) && values.every((value) => typeof value === 'string')) setSuggestions(values)
      })
      .catch(() => {
        // Suggestions are optional; a failed read must not block the form.
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!draftKey || hydratedDraftKey.current === draftKey) return
    hydratedDraftKey.current = draftKey
    let draft: Partial<{
      tipo: Tipo; isIngreso: boolean; selectedCategory: string; amount: string
      description: string; date: string; paidBy: string; installments: number
      requestKey: string
    }> | null = null
    try {
      const accountId = draftKey.split(':')[1]
      const activeAccountMarker = 'expense-draft:active-user'
      const previousAccountId = sessionStorage.getItem(activeAccountMarker)
      if (previousAccountId && previousAccountId !== accountId) {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith('expense-draft:') && key !== activeAccountMarker) sessionStorage.removeItem(key)
        }
      }
      sessionStorage.setItem(activeAccountMarker, accountId)
      const saved = sessionStorage.getItem(draftKey)
      if (saved) draft = JSON.parse(saved)
    } catch {
      try { sessionStorage.removeItem(draftKey) } catch { /* Ignore disabled browser storage. */ }
    }
    if (draft?.tipo === 'individual' || draft?.tipo === 'pareja') setTipo(draft.tipo)
    if (typeof draft?.isIngreso === 'boolean') setIsIngreso(draft.isIngreso)
    if (typeof draft?.selectedCategory === 'string') setSelectedCategory(draft.selectedCategory)
    if (typeof draft?.amount === 'string') setAmount(draft.amount)
    if (typeof draft?.description === 'string') setDescription(draft.description)
    if (typeof draft?.date === 'string') setDate(draft.date)
    if (typeof draft?.paidBy === 'string') setPaidBy(draft.paidBy)
    if (Number.isInteger(draft?.installments) && draft!.installments! >= 1 && draft!.installments! <= MAX_INSTALLMENTS) setInstallments(draft!.installments!)
    setRequestKey(mode === 'add' ? restoreExpenseRequestKey(draft, createRequestId) : '')
    // Browser storage is external state; this marks the one-time restoration for this form identity.
    setRestoredDraftKey(draftKey)
  }, [draftKey, mode])

  useEffect(() => {
    if (!draftKey || restoredDraftKey !== draftKey) return
    if (state?.success) {
      try { sessionStorage.removeItem(draftKey) } catch { /* Ignore disabled browser storage. */ }
      router.replace(state.success)
      return
    }
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ tipo, isIngreso, selectedCategory, amount, description, date, paidBy, installments, requestKey }))
    } catch {
      // The current form remains usable if storage is disabled by the browser.
    }
  }, [amount, date, description, draftKey, installments, isIngreso, paidBy, requestKey, restoredDraftKey, router, selectedCategory, state?.success, tipo])

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
    <form action={formAction} aria-busy={pending} className="flex flex-col gap-5 pb-8">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="category" value={selectedCategory || (isIngreso ? 'otros' : '')} />
      <input type="hidden" name="is_income" value={isIngreso ? '1' : '0'} />
      {mode === 'add' && <input type="hidden" name="request_key" value={requestKey} />}
      {mode === 'edit' && tipo === 'pareja' && <input type="hidden" name="paid_by" value={paidBy} />}
      {canSplit && <input type="hidden" name="installments" value={installments} />}
      <fieldset disabled={pending} className="contents" aria-busy={pending}>

      {/* Gasto / Ingreso switch */}
      <div>
        <p className="text-sm text-gray-400 mb-2 font-medium">Tipo</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTipoChange(false)}
            aria-pressed={!isIngreso}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
              !isIngreso ? 'bg-rose-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            💸 Gasto
          </button>
          <button
            type="button"
            onClick={() => handleTipoChange(true)}
            aria-pressed={isIngreso}
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
              aria-pressed={tipo === t}
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
        <label htmlFor="expense-amount" className="block text-base text-gray-200 mb-2 font-semibold">Monto</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
          <input
            id="expense-amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            required
            placeholder="0"
            aria-invalid={state?.field === 'amount'}
            aria-describedby={state?.field === 'amount' ? 'expense-amount-error' : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-4 py-3.5 text-white text-xl font-semibold placeholder-gray-700 focus:outline-none focus:border-emerald-600 transition-colors"
          />
        </div>
        {state?.field === 'amount' && <p id="expense-amount-error" role="alert" aria-live="assertive" className="mt-2 text-sm text-red-300">{state.error}</p>}
      </div>

      <div>
        <label htmlFor="expense-description" className="block text-sm text-gray-300 mb-2 font-medium">
          Referencia {needsDescription ? <span className="text-amber-300">(obligatoria en Otros)</span> : <span className="text-gray-500">(recomendada)</span>}
        </label>
        <input
          id="expense-description"
          name="description"
          type="text"
          list="description-suggestions"
          required={needsDescription}
          aria-invalid={state?.field === 'description'}
          aria-describedby={state?.field === 'description' ? 'expense-description-error' : undefined}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isIngreso ? 'Ej: sueldo, freelance' : 'Ej: almuerzo con amigos'}
          className="w-full min-h-12 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-base"
        />
        <datalist id="description-suggestions">
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        {state?.field === 'description' && <p id="expense-description-error" role="alert" aria-live="assertive" className="mt-2 text-sm text-red-300">{state.error}</p>}
      </div>

      {/* Cuotas */}
      {canSplit && (
        <div>
          <p className="text-sm text-gray-400 mb-2 font-medium">Cuotas</p>
          <div role="group" aria-label="Cantidad de cuotas" aria-describedby={state?.field === 'installments' ? 'expense-installments-error' : undefined} className="flex gap-2">
            {[1, 3, 6, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setInstallments(n)}
                className={`min-h-11 flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
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
              className="min-h-11 w-16 bg-gray-900 border border-gray-800 rounded-xl px-2 text-center text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 text-base"
            />
          </div>
          {state?.field === 'installments' && <p id="expense-installments-error" role="alert" aria-live="assertive" className="mt-2 text-sm text-red-300">{state.error}</p>}
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
          <p className="text-sm text-gray-300 mb-2 font-medium">Categoría</p>
          <div role="group" aria-label="Categoría" aria-describedby={state?.field === 'category' ? 'expense-category-error' : undefined} className="grid grid-cols-4 gap-2">
            {CATEGORIES.filter(({ id }) => ['supermercado', 'comida', 'transporte', 'servicios'].includes(id)).map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCategory(id)}
                aria-pressed={selectedCategory === id}
                className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 text-[11px] font-medium transition-colors ${
                  selectedCategory === id ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                <span className="text-2xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <details className="mt-2" open={Boolean(selectedCategory && !['supermercado', 'comida', 'transporte', 'servicios'].includes(selectedCategory))}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-emerald-300">Todas las categorías</summary>
            <div className="grid grid-cols-3 gap-2 pt-2">
              {CATEGORIES.filter(({ id }) => !['supermercado', 'comida', 'transporte', 'servicios'].includes(id)).map(({ id, label, icon }) => (
                <button key={id} type="button" onClick={() => setSelectedCategory(id)} aria-pressed={selectedCategory === id}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium ${selectedCategory === id ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>
                  <span className="text-2xl" aria-hidden="true">{icon}</span>{label}
                </button>
              ))}
            </div>
          </details>
          {state?.field === 'category' && <p id="expense-category-error" role="alert" aria-live="assertive" className="mt-2 text-sm text-red-300">{state.error}</p>}
        </div>
      )}

      {/* Fecha */}
      <div>
        <label htmlFor="expense-date" className="block text-sm text-gray-300 mb-2 font-medium">{installments > 1 && canSplit ? 'Fecha de la primera cuota' : 'Fecha'}</label>
        <input
          id="expense-date"
          name="date"
          type="date"
          aria-invalid={state?.field === 'date'}
          aria-describedby={state?.field === 'date' ? 'expense-date-error' : undefined}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-600 transition-colors text-base"
        />
        {state?.field === 'date' && <p id="expense-date-error" role="alert" aria-live="assertive" className="mt-2 text-sm text-red-300">{state.error}</p>}
      </div>

      {state?.error && (!state.field || state.field === 'form') && (
        <p role="alert" aria-live="assertive" className="text-red-300 text-sm bg-red-950/50 rounded-xl py-2.5 px-4">{state.error}</p>
      )}

      {state?.duplicate ? (
        <div role="alert" aria-live="assertive" className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex flex-col gap-3">
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
              className="min-h-11 flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-3"
            >
              No, guardarlo igual
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending || (mode === 'add' && !requestKey) || (!isIngreso && !selectedCategory)}
          aria-disabled={pending || (mode === 'add' && !requestKey) || (!isIngreso && !selectedCategory)}
          className={`${
            isIngreso ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
          } sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 min-h-12 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 text-base transition-colors mt-2 shadow-lg shadow-gray-950/80`}
        >
          {pending ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : cuotas ? `Guardar ${installments} cuotas` : `Guardar ${noun}`}
        </button>
      )}
      </fieldset>
      {draftKey && <button type="button" disabled={pending} onClick={() => { try { sessionStorage.removeItem(draftKey) } catch { /* Ignore disabled browser storage. */ } router.push(backHref) }} className="min-h-11 self-center px-3 text-sm text-gray-400 underline underline-offset-4 disabled:opacity-50">Descartar borrador y volver</button>}
    </form>
  )
}

function formatDay(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: '2-digit' })
}
