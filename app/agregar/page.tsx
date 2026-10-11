import { addExpense } from '@/actions/expenses'
import BottomNav from '@/components/BottomNav'
import ExpenseForm from '@/components/ExpenseForm'
import { getRecentDescriptions, verifySession } from '@/lib/dal'

export default async function AgregarPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const session = await verifySession()
  const { tipo } = await searchParams
  const suggestions = await getRecentDescriptions(session.userId, session.coupleId)

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold text-white mb-6">Agregar</h1>
        <ExpenseForm
          mode="add"
          action={addExpense}
          suggestions={suggestions}
          initial={{
            tipo: tipo === 'pareja' ? 'pareja' : 'individual',
            isIncome: false,
            category: '',
            amount: '',
            description: '',
            date: new Date().toISOString().split('T')[0],
          }}
        />
      </div>
      <BottomNav />
    </div>
  )
}
