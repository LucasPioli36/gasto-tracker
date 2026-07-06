import { redirect } from 'next/navigation'
import { logout } from '@/actions/auth'
import ProgressBar from '@/components/ProgressBar'
import { getCurrentUser, getIndividualExpenses, getCoupleData, verifySession } from '@/lib/dal'

function formatUYU(amount: number) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function currentMonthLabel() {
  return new Date().toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })
}

export default async function HomePage() {
  const session = await verifySession()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const expenses = await getIndividualExpenses(user.id)
  const totalGastado = expenses.reduce((sum, e) => sum + e.amount, 0)
  const limiteGasto = user.salary - user.savings_goal
  const disponible = limiteGasto - totalGastado

  const coupleData = session.coupleId ? await getCoupleData(session.coupleId) : null
  const totalDepositado = coupleData?.deposits.reduce((s, d) => s + d.amount, 0) ?? 0
  const totalGastadoPareja = coupleData?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0
  const disponiblePareja = totalDepositado - totalGastadoPareja

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm capitalize">{currentMonthLabel()}</p>
          <h1 className="text-xl font-bold text-white">Hola, {user.name} 👋</h1>
        </div>
        <form action={logout}>
          <button type="submit" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
            Salir
          </button>
        </form>
      </div>

      {/* Individual card */}
      <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm font-medium">Mis gastos</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">Individual</span>
        </div>

        <div>
          <p className="text-gray-400 text-xs mb-1">Disponible</p>
          <p className={`text-3xl font-bold ${disponible < 0 ? 'text-red-400' : disponible < limiteGasto * 0.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {formatUYU(disponible)}
          </p>
        </div>

        <ProgressBar value={totalGastado} max={limiteGasto} />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-600">Sueldo</p>
            <p className="text-sm font-semibold text-white">{formatUYU(user.salary)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Meta ahorro</p>
            <p className="text-sm font-semibold text-emerald-400">{formatUYU(user.savings_goal)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Gastado</p>
            <p className="text-sm font-semibold text-white">{formatUYU(totalGastado)}</p>
          </div>
        </div>
      </div>

      {/* Couple card */}
      {coupleData ? (
        <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm font-medium">Pareja</span>
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">Compartido</span>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-1">Disponible</p>
            <p className={`text-3xl font-bold ${disponiblePareja < 0 ? 'text-red-400' : disponiblePareja < (coupleData.couple?.monthly_budget ?? 0) * 0.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {formatUYU(disponiblePareja)}
            </p>
          </div>

          <ProgressBar value={totalGastadoPareja} max={totalDepositado > 0 ? totalDepositado : (coupleData.couple?.monthly_budget ?? 1)} />

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-600">Presupuesto</p>
              <p className="text-sm font-semibold text-white">{formatUYU(coupleData.couple?.monthly_budget ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Depositado</p>
              <p className="text-sm font-semibold text-emerald-400">{formatUYU(totalDepositado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Gastado</p>
              <p className="text-sm font-semibold text-white">{formatUYU(totalGastadoPareja)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-5 text-center text-gray-600 text-sm">
          Sin cuenta de pareja configurada
        </div>
      )}
    </div>
  )
}
