import ProgressBar from '@/components/ProgressBar'
import ExpenseItem from '@/components/ExpenseItem'
import BottomNav from '@/components/BottomNav'
import { getCurrentUser, getIndividualExpenses } from '@/lib/dal'
import { redirect } from 'next/navigation'

function formatUYU(amount: number) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function groupByDate(expenses: { date: string; [key: string]: unknown }[]) {
  const groups: Record<string, typeof expenses> = {}
  for (const e of expenses) {
    if (!groups[e.date]) groups[e.date] = []
    groups[e.date].push(e)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

function formatDateHeader(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default async function IndividualPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const expenses = await getIndividualExpenses(user.id)
  const totalGastado = expenses.reduce((sum, e) => sum + e.amount, 0)
  const limiteGasto = user.salary - user.savings_goal
  const disponible = limiteGasto - totalGastado
  const grouped = groupByDate(expenses)

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-bold text-white">Mis gastos</h1>

          {/* Summary card */}
          <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Disponible este mes</p>
              <p className={`text-3xl font-bold ${disponible < 0 ? 'text-red-400' : disponible < limiteGasto * 0.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatUYU(disponible)}
              </p>
            </div>
            <ProgressBar value={totalGastado} max={limiteGasto} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-600">Límite</p>
                <p className="text-sm font-semibold text-white">{formatUYU(limiteGasto)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Gastado</p>
                <p className="text-sm font-semibold text-white">{formatUYU(totalGastado)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Meta ahorro</p>
                <p className="text-sm font-semibold text-emerald-400">{formatUYU(user.savings_goal)}</p>
              </div>
            </div>
          </div>

          {/* Expense list */}
          {grouped.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm">Sin gastos este mes</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {grouped.map(([date, items]) => (
                <div key={date} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider capitalize">
                    {formatDateHeader(date)}
                  </p>
                  <div className="flex flex-col gap-2">
                    {items.map((e) => (
                      <ExpenseItem
                        key={e.id as string}
                        id={e.id as string}
                        amount={e.amount as number}
                        category={e.category as string}
                        description={e.description as string | null}
                        date={e.date as string}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
