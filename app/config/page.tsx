import BottomNav from '@/components/BottomNav'
import { getCurrentUser, getCoupleData, verifySession } from '@/lib/dal'
import UserConfigForm from './UserConfigForm'
import CoupleConfigForm from './CoupleConfigForm'
import { redirect } from 'next/navigation'

export default async function ConfigPage() {
  const session = await verifySession()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const coupleData = session.coupleId ? await getCoupleData(session.coupleId) : null

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">
        <h1 className="text-xl font-bold text-white mb-6">Configuración</h1>

        <div className="flex flex-col gap-4">
          {/* User config */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">Mis finanzas</h2>
            <UserConfigForm salary={user.salary} savingsGoal={user.savings_goal} />
          </div>

          {/* Couple config */}
          {coupleData && (
            <div className="bg-gray-900 rounded-2xl p-5">
              <h2 className="text-base font-semibold text-white mb-4">Pareja</h2>
              <CoupleConfigForm monthlyBudget={coupleData.couple?.monthly_budget ?? 0} />
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl p-4 text-sm text-gray-600 text-center">
            <p>Usuario: <span className="text-gray-400">{user.username}</span></p>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
