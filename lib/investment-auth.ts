import 'server-only'
import { notFound } from 'next/navigation'
import { getCurrentUser, verifySession } from '@/lib/dal'

export async function requireInvestmentOwner() {
  const session = await verifySession()
  const user = await getCurrentUser()
  const configuredUsername = process.env.INVESTMENTS_OWNER_USERNAME?.trim().toLowerCase()
  if (!user || !configuredUsername || user.username.toLowerCase() !== configuredUsername) notFound()
  return session
}
