import ProgressBar from '@/components/ProgressBar'
import ExpenseItem from '@/components/ExpenseItem'
import BottomNav from '@/components/BottomNav'
import { getCoupleData, verifySession } from '@/lib/dal'
import DepositForm from './DepositForm'

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

export default async function ParejaPage() {
  const session = await verifySession()

  if (!session.coupleId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center text-gray-500 px-8">
          <p className="text-4xl mb-4">💑</p>
          <p className="text-sm">Sin cuenta de pareja configurada</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  const { couple, expenses, deposits } = await getCoupleData(session.coupleId)
  const totalDepositado = deposits.reduce((s, d) => s + d.amount, 0)
  const totalGastado = expenses.reduce((s, e) => s + e.amount, 0)
  const disponible = totalDepositado - totalGastado
  const presupuesto = couple?.monthly_budget ?? 0
  const grouped = groupByDate(expenses)

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-bold text-white">Pareja</h1>

          {/* Summary */}
          <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Disponible este mes</p>
              <p className={`text-3xl font-bold ${disponible < 0 ? 'text-red-400' : disponible < presupuesto * 0.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatUYU(disponible)}
              </p>
            </div>
            <ProgressBar value={totalGastado} max={totalDepositado > 0 ? totalDepositado : presupuesto || 1} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-600">Presupuesto</p>
                <p className="text-sm font-semibold text-white">{formatUYU(presupuesto)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Depositado</p>
                <p className="text-sm font-semibold text-emerald-400">{formatUYU(totalDepositado)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Gastado</p>
                <p className="text-sm font-semibold text-white">{formatUYU(totalGastado)}</p>
              </div>
            </div>
          </div>

          {/* Deposits this month */}
          {deposits.length > 0 && (
            <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Depósitos del mes</p>
              {deposits.map((d) => (
                <div key={d.id} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-300">{(d.users as { name: string } | undefined)?.name ?? 'Alguien'}</span>
                  <span className="text-sm font-semibold text-emerald-400">+{formatUYU(d.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add deposit */}
          <DepositForm />

          {/* Expense list */}
          {grouped.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm">Sin gastos de pareja este mes</p>
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
