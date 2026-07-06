'use client'
import { Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { deleteExpense } from '@/actions/expenses'
import { getCategoryIcon, getCategoryLabel } from '@/lib/categories'

type Props = {
  id: string
  amount: number
  category: string
  description: string | null
  date: string
}

export default function ExpenseItem({ id, amount, category, description, date }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm('¿Eliminar este gasto?')) return
    startTransition(() => deleteExpense(id))
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-gray-900 transition-opacity ${isPending ? 'opacity-40' : ''}`}>
      <span className="text-2xl">{getCategoryIcon(category)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {description || getCategoryLabel(category)}
        </p>
        <p className="text-xs text-gray-500">{getCategoryLabel(category)} · {formatDate(date)}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">{formatUYU(amount)}</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-gray-700 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 size={16} />
        </button>
      </div>
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
