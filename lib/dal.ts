import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './session'
import { db } from './db'
import { movementTotals } from './totals'

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
  expenses: { id: string; amount: number; category: string; description: string | null; date: string; user_id: string | null; couple_id: string | null; created_at: string; is_income: boolean; createdByName: string | null }[]
}> => {
  const { start, end } = currentMonthRange()

  const [coupleRes, expensesRes] = await Promise.all([
    db.from('couple').select('*').eq('id', coupleId).single(),
    db.from('expenses').select('*').eq('couple_id', coupleId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const couple = coupleRes.data as { id: string; user1_id: string; user2_id: string; monthly_budget: number } | null
  const rawExpenses = (expensesRes.data ?? []) as { id: string; amount: number; category: string; description: string | null; date: string; user_id: string | null; couple_id: string | null; created_by: string | null; created_at: string; is_income: boolean }[]

  let nameMap: Record<string, string> = {}
  if (couple) {
    const { data: users } = await db
      .from('users')
      .select('id, name')
      .in('id', [couple.user1_id, couple.user2_id])
    if (users) nameMap = Object.fromEntries(users.map((u) => [u.id, u.name]))
  }

  return {
    couple,
    expenses: rawExpenses.map((e) => ({
      ...e,
      createdByName: e.created_by ? (nameMap[e.created_by] ?? null) : null,
    })),
  }
})

// Los meses se agrupan por el prefijo YYYY-MM del campo date (string),
// sin pasar por Date/toISOString para evitar corrimientos de timezone.
function lastMonthsMeta(count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthName = d.toLocaleDateString('es-UY', { month: 'long' })
    const label = d.getFullYear() === now.getFullYear() ? monthName : `${monthName} ${d.getFullYear()}`
    return { key, label, current: i === count - 1 }
  })
}

export const getIndividualHistory = cache(async (userId: string, count = 6) => {
  const months = lastMonthsMeta(count)
  const { data } = await db
    .from('expenses')
    .select('amount, date, is_income')
    .eq('user_id', userId)
    .gte('date', `${months[0].key}-01`)

  const byMonth = new Map<string, { amount: number; is_income: boolean }[]>()
  for (const e of data ?? []) {
    const key = e.date.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(e)
  }

  return months.map((m) => ({ ...m, ...movementTotals(byMonth.get(m.key) ?? []) }))
})

export const getCoupleHistory = cache(async (coupleId: string, monthlyBudget = 0, count = 6) => {
  const months = lastMonthsMeta(count)
  const start = `${months[0].key}-01`

  const { data } = await db.from('expenses').select('amount, date, is_income').eq('couple_id', coupleId).gte('date', start)

  const expByMonth = new Map<string, { amount: number; is_income: boolean }[]>()
  for (const e of data ?? []) {
    const key = e.date.slice(0, 7)
    if (!expByMonth.has(key)) expByMonth.set(key, [])
    expByMonth.get(key)!.push(e)
  }

  return months.map((m) => {
    const { spent, income } = movementTotals(expByMonth.get(m.key) ?? [])
    return { ...m, spent, income, fondo: monthlyBudget + income }
  })
})
