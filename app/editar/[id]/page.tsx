import { notFound } from 'next/navigation'
import { updateExpense } from '@/actions/expenses'
import BottomNav from '@/components/BottomNav'
import ExpenseForm from '@/components/ExpenseForm'
import { getCoupleData, getExpenseForEdit, getRecentDescriptions, verifySession } from '@/lib/dal'

export default async function EditarPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession()
  const { id } = await params
  const expense = await getExpenseForEdit(id)
  if (!expense) notFound()

  const [suggestions, coupleData] = await Promise.all([
    getRecentDescriptions(session.userId, session.coupleId),
    session.coupleId ? getCoupleData(session.coupleId) : null,
  ])

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-white mb-6">{expense.is_income ? 'Editar ingreso' : 'Editar gasto'}</h1>
        <ExpenseForm
          mode="edit"
          action={updateExpense.bind(null, expense.id)}
          suggestions={suggestions}
          members={coupleData?.members ?? []}
          initial={{
            tipo: expense.couple_id ? 'pareja' : 'individual',
            isIncome: expense.is_income,
            category: expense.category,
            amount: String(expense.amount),
            description: expense.description ?? '',
            date: expense.date,
            // Gasto de pareja sin asignar: queda vacío hasta que se elija quién pagó.
            paidBy: expense.couple_id ? expense.created_by : session.userId,
          }}
        />
      </div>
      <BottomNav />
    </div>
  )
}
