import { getCurrentUser } from '@/lib/dal'
import BottomNavClient from '@/components/BottomNavClient'

export default async function BottomNav() {
  const user = await getCurrentUser()
  const ownerUsername = process.env.INVESTMENTS_OWNER_USERNAME?.trim().toLowerCase()
  const showInvestments = Boolean(user && ownerUsername && user.username.toLowerCase() === ownerUsername)

  return <BottomNavClient showInvestments={showInvestments} />
}
