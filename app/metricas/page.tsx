import BottomNav from '@/components/BottomNav'
import { getCurrentUser, getIndividualExpenses, getCoupleData, getIndividualHistory, getCoupleHistory, verifySession } from '@/lib/dal'
import { movementTotals, categoryTotals } from '@/lib/totals'
import { formatUYU } from '@/lib/format'
import { getCategoryIcon, getCategoryLabel } from '@/lib/categories'
import { redirect } from 'next/navigation'

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

function CategoryCard({ title, rows }: { title: string; rows: { category: string; total: number }[] }) {
  const max = rows[0]?.total ?? 1
  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-2">Sin gastos este mes</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.category} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">{getCategoryIcon(r.category)}</span>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{getCategoryLabel(r.category)}</span>
                  <span className="text-white font-semibold">{formatUYU(r.total)}</span>
                </div>
                <Bar pct={(r.total / max) * 100} color="bg-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default async function MetricasPage() {
  const session = await verifySession()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const expenses = await getIndividualExpenses(user.id)
  const coupleData = session.coupleId ? await getCoupleData(session.coupleId) : null
  const individualHistory = await getIndividualHistory(user.id)
  const coupleHistory = session.coupleId ? await getCoupleHistory(session.coupleId) : null

  // Ritmo del mes
  const { spent: gastado, income: ingresos } = movementTotals(expenses)
  const limite = user.salary + ingresos - user.savings_goal
  const now = new Date()
  const dia = now.getDate()
  const diasDelMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const esperado = limite * (dia / diasDelMes)
  const proyeccion = dia > 0 ? (gastado / dia) * diasDelMes : 0
  const delta = gastado - esperado
  const proyColor = gastado > limite ? 'text-red-400' : proyeccion > limite ? 'text-amber-400' : 'text-emerald-400'

  const maxIndividual = Math.max(...individualHistory.map((m) => m.spent), 1)
  const maxPareja = coupleHistory ? Math.max(...coupleHistory.flatMap((m) => [m.fondo, m.spent]), 1) : 1

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">
        <p className="text-gray-500 text-sm capitalize">{now.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })}</p>
        <h1 className="text-xl font-bold text-white mb-6">Métricas</h1>

        <div className="flex flex-col gap-4">
          {/* Ritmo del mes */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ritmo del mes</h2>
            <p className="text-gray-400 text-xs">A este ritmo terminás en</p>
            <p className={`text-3xl font-bold mb-3 ${proyColor}`}>{formatUYU(proyeccion)}</p>
            <div className="relative mb-2">
              <div className="w-full bg-gray-800 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${gastado > limite ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${limite > 0 ? Math.min((gastado / limite) * 100, 100) : 0}%` }}
                />
              </div>
              <div
                className="absolute w-0.5 bg-gray-400"
                style={{ left: `${limite > 0 ? Math.min((esperado / limite) * 100, 100) : 0}%`, height: '18px', top: '-4px' }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mb-3">
              <span>Gastado: <span className="text-white">{formatUYU(gastado)}</span></span>
              <span>Esperado: <span className="text-gray-400">{formatUYU(esperado)}</span></span>
              <span>Límite: <span className="text-white">{formatUYU(limite)}</span></span>
            </div>
            <p className={`text-xs ${delta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {delta > 0
                ? `Vas ${formatUYU(delta)} por encima del ritmo del mes`
                : `Vas ${formatUYU(-delta)} por debajo del ritmo del mes`}
            </p>
          </div>

          {/* Por categoría */}
          <CategoryCard title="Por categoría · Yo" rows={categoryTotals(expenses)} />
          {coupleData && <CategoryCard title="Por categoría · Pareja" rows={categoryTotals(coupleData.expenses)} />}

          {/* Últimos 6 meses — individual */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Últimos 6 meses · Yo</h2>
            <div className="flex flex-col gap-3">
              {individualHistory.map((m) => {
                const limiteMes = user.salary + m.income - user.savings_goal
                const pasado = m.spent > limiteMes
                return (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={m.current ? 'text-gray-200' : 'text-gray-400'}>
                        {capitalize(m.label)}{m.current ? ' (en curso)' : ''}
                      </span>
                      <span className="text-white font-semibold">{formatUYU(m.spent)}</span>
                    </div>
                    <Bar pct={(m.spent / maxIndividual) * 100} color={pasado ? 'bg-red-500' : 'bg-emerald-500'} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Últimos 6 meses — pareja */}
          {coupleHistory && (
            <div className="bg-gray-900 rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Pareja · fondo vs gastado</h2>
              <div className="flex flex-col gap-4">
                {coupleHistory.map((m) => (
                  <div key={m.key}>
                    <p className={`text-xs mb-1.5 ${m.current ? 'text-gray-200' : 'text-gray-400'}`}>
                      {capitalize(m.label)}{m.current ? ' (en curso)' : ''}
                    </p>
                    <div className="flex flex-col gap-1">
                      <Bar pct={(m.fondo / maxPareja) * 100} color="bg-emerald-500" />
                      <Bar pct={(m.spent / maxPareja) * 100} color="bg-rose-500" />
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5">
                      Fondo {formatUYU(m.fondo)} · Gastado {formatUYU(m.spent)} · Ahorro{' '}
                      <span className={m.fondo - m.spent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {formatUYU(m.fondo - m.spent)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
