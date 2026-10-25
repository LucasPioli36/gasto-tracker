import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PortfolioPanel from '@/components/PortfolioPanel'
import { getCurrentUser } from '@/lib/dal'
import { requireInvestmentOwner } from '@/lib/investment-auth'
import { getInvestmentDashboard } from '@/lib/investments'
import { todayInMontevideo } from '@/lib/investment-format'

export const dynamic = 'force-dynamic'

export default async function InvestmentsPage() {
  await requireInvestmentOwner()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const dashboard = await getInvestmentDashboard(user.id)
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 pt-6 pb-28">
        <PortfolioPanel {...dashboard} setupDate={todayInMontevideo()} />
      </div>
      <BottomNav />
    </div>
  )
}
