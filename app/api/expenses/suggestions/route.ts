import { getRecentDescriptions } from '@/lib/dal'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session?.userId) return Response.json({ suggestions: [] }, { status: 401 })

  try {
    const suggestions = await getRecentDescriptions(session.userId, session.coupleId)
    return Response.json({ suggestions })
  } catch {
    return Response.json({ suggestions: [] }, { status: 503 })
  }
}
