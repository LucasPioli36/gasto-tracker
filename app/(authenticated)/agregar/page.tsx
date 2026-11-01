import { addExpense } from '@/actions/expenses'
import ExpenseForm from '@/components/ExpenseForm'
import { verifySession } from '@/lib/dal'
import { todayInMontevideo } from '@/lib/investment-format'

export default async function AgregarPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const session = await verifySession()
  const { tipo } = await searchParams

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-white mb-6">Agregar</h1>
        <ExpenseForm
          mode="add"
          action={addExpense}
          draftKey={`expense-draft:${session.userId}:new`}
          initial={{
            tipo: tipo === 'pareja' ? 'pareja' : 'individual',
            isIncome: false,
            category: '',
            amount: '',
            description: '',
            date: todayInMontevideo(),
          }}
        />
      </div>
    </div>
  )
}
