import { getCurrentUser } from '@/lib/dal'
import { getSession } from '@/lib/session'
import BottomNavClient from '@/components/BottomNavClient'

export default async function BottomNav() {
  const session = await getSession()
  if (!session?.userId) return <BottomNavClient showInvestments={false} />

  let showInvestments = false
  try {
    const user = await getCurrentUser()
    const ownerUsername = process.env.INVESTMENTS_OWNER_USERNAME?.trim().toLowerCase()
    showInvestments = Boolean(user && ownerUsername && user.username.toLowerCase() === ownerUsername)
  } catch {
    // Keep the shared navigation available during a profile read failure.
  }
  return <BottomNavClient showInvestments={showInvestments} />
}
