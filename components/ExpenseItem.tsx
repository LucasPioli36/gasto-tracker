'use client'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { deleteExpense } from '@/actions/expenses'
import { getCategoryIcon, getCategoryLabel } from '@/lib/categories'

type Props = {
  id: string
  amount: number
  category: string
  description: string | null
  date: string
  is_income?: boolean
  createdBy?: string | null
  shared?: boolean
}

export default function ExpenseItem({ id, amount, category, description, date, is_income, createdBy, shared }: Props) {
  const [isPending, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = () => {
    if (!confirm(is_income ? '¿Eliminar este ingreso?' : '¿Eliminar este gasto?')) return
    setDeleteError('')
    startTransition(async () => {
      const result = await deleteExpense(id)
      if (result.error) setDeleteError(result.error)
    })
  }

  return (
    <div className="space-y-1">
    <div className={`flex items-center gap-2 p-2 rounded-xl bg-gray-900 transition-opacity ${isPending ? 'opacity-60' : ''}`} aria-busy={isPending}>
      <span className="text-2xl">{is_income ? '💰' : getCategoryIcon(category)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {description || (is_income ? 'Ingreso' : getCategoryLabel(category))}
        </p>
        <p className="text-xs text-gray-500">
          {is_income ? 'Ingreso' : getCategoryLabel(category)} · {formatDate(date)}
          {createdBy && <span className="text-gray-600"> · {createdBy}</span>}
          {shared && <span className="text-gray-600"> · Pareja</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${is_income ? 'text-emerald-400' : 'text-white'}`}>
          {is_income ? '+' : ''}{formatUYU(amount)}
        </span>
        <Link href={`/editar/${id}`} prefetch={false} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Editar movimiento">
          <Pencil size={16} />
        </Link>
        <button
          onClick={handleDelete}
          aria-label="Eliminar movimiento"
          disabled={isPending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 disabled:cursor-wait"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
    {deleteError && <p role="alert" aria-live="assertive" className="px-2 text-xs text-red-300">{deleteError}</p>}
    </div>
  )
}

function formatUYU(amount: number) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}
