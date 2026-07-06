import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './session'
import { db } from './db'

export const verifySession = cache(async () => {
  const session = await getSession()
  if (!session?.userId) redirect('/login')
  return session
})

export const getCurrentUser = cache(async () => {
  const session = await verifySession()
  const { data } = await db
    .from('users')
    .select('id, name, username, salary, savings_goal')
    .eq('id', session.userId)
    .single()
  return data
})

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

export const getIndividualExpenses = cache(async (userId: string) => {
  const { start, end } = currentMonthRange()
  const { data } = await db
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
})

export const getCoupleData = cache(async (coupleId: string): Promise<{
  couple: { id: string; user1_id: string; user2_id: string; monthly_budget: number } | null
  expenses: { id: string; amount: number; category: string; description: string | null; date: string; user_id: string | null; couple_id: string | null; created_at: string }[]
  deposits: { id: string; couple_id: string; user_id: string; amount: number; date: string; users: { name: string } | null }[]
}> => {
  const { start, end } = currentMonthRange()

  const [coupleRes, expensesRes, depositsRes] = await Promise.all([
    db.from('couple').select('*').eq('id', coupleId).single(),
    db.from('expenses').select('*').eq('couple_id', coupleId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    db.from('couple_deposits').select('id, couple_id, user_id, amount, date, users(name)').eq('couple_id', coupleId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false }),
  ])

  return {
    couple: coupleRes.data as { id: string; user1_id: string; user2_id: string; monthly_budget: number } | null,
    expenses: (expensesRes.data ?? []) as { id: string; amount: number; category: string; description: string | null; date: string; user_id: string | null; couple_id: string | null; created_at: string }[],
    deposits: ((depositsRes.data ?? []) as unknown as { id: string; couple_id: string; user_id: string; amount: number; date: string; users: { name: string } | null }[]),
  }
})
