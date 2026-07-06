'use client'
import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { addExpense } from '@/actions/expenses'
import { CATEGORIES } from '@/lib/categories'
import BottomNav from '@/components/BottomNav'

function AgregarForm() {
  const searchParams = useSearchParams()
  const defaultTipo = (searchParams.get('tipo') as 'individual' | 'pareja') ?? 'individual'
  const [tipo, setTipo] = useState<'individual' | 'pareja'>(defaultTipo)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [error, action, pending] = useActionState(addExpense, null)

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-white mb-6">Agregar gasto</h1>

        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="category" value={selectedCategory} />

          {/* Tipo toggle */}
          <div>
            <p className="text-sm text-gray-400 mb-2 font-medium">¿Para quién?</p>
            <div className="flex gap-2">
              {(['individual', 'pareja'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors capitalize ${
                    tipo === t
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {t === 'individual' ? '👤 Yo' : '💑 Pareja'}
                </button>
              ))}
            </div>
          </div>

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
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-4 py-3.5 text-white text-xl font-semibold placeholder-gray-700 focus:outline-none focus:border-emerald-600 transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-sm text-gray-400 mb-2 font-medium">Categoría</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedCategory(id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${
                    selectedCategory === id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <span className="text-2xl">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm text-gray-400 mb-2 font-medium">Descripción <span className="text-gray-600">(opcional)</span></p>
            <input
              name="description"
              type="text"
              placeholder="Ej: almuerzo con amigos"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition-colors text-base"
            />
          </div>

          {/* Date */}
          <div>
            <p className="text-sm text-gray-400 mb-2 font-medium">Fecha</p>
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-600 transition-colors text-base"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950/50 rounded-xl py-2.5 px-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !selectedCategory}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 text-base transition-colors mt-2"
          >
            {pending ? 'Guardando...' : 'Guardar gasto'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AgregarPage() {
  return (
    <>
      <Suspense>
        <AgregarForm />
      </Suspense>
      <BottomNav />
    </>
  )
}
