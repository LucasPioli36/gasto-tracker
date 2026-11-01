import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from './session'
import { db } from './db'
import { movementTotals, contributionTotals } from './totals'

export const verifySession = cache(async () => {
  const session = await getSession()
  if (!session?.userId) redirect('/login')
  return session
})

export const getCurrentUser = cache(async () => {
  const session = await verifySession()
  const { data, error } = await db
    .from('users')
    .select('id, name, username, salary, savings_goal')
    .eq('id', session.userId)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error('No se pudo cargar el perfil.')
  return data
})

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

// Lo individual = mis movimientos propios + los gastos de pareja que yo cargué.
// Los ingresos de pareja van al fondo común, no a mi bolsillo.
// WHERE user_id = :me OR (created_by = :me AND NOT (couple_id IS NOT NULL AND is_income))
function ownMovementsFilter(userId: string) {
  return `user_id.eq.${userId},created_by.eq.${userId}`
}

function isOwnMovement(row: { couple_id: string | null; is_income: boolean }) {
  return !(row.couple_id && row.is_income)
}

export const getIndividualExpenses = cache(async (userId: string) => {
  const { start, end } = currentMonthRange()
  const { data, error } = await db
    .from('expenses')
    .select('id, amount, category, description, date, is_income, couple_id, created_at')
    .or(ownMovementsFilter(userId))
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error('No se pudieron cargar los movimientos individuales.')
  return (data ?? []).filter(isOwnMovement)
})

export const getCoupleMetadata = cache(async (coupleId: string): Promise<{
  couple: { id: string; user1_id: string; user2_id: string; monthly_budget: number; user1_name: string; user2_name: string } | null
  members: { id: string; name: string }[]
} | null> => {
  const { data: rawCouple, error: coupleError } = await db.from('couple')
    .select('id, user1_id, user2_id, monthly_budget')
    .eq('id', coupleId)
    .maybeSingle()
  if (coupleError) throw new Error('No se pudo cargar la configuración de pareja.')
  if (!rawCouple) return null

  const { data: users, error: membersError } = await db.from('users')
    .select('id, name')
    .in('id', [rawCouple.user1_id, rawCouple.user2_id])
  if (membersError) throw new Error('No se pudieron cargar los integrantes de pareja.')
  const nameMap = Object.fromEntries((users ?? []).map((user) => [user.id, user.name]))
  const couple = {
    ...rawCouple,
    user1_name: nameMap[rawCouple.user1_id] ?? '',
    user2_name: nameMap[rawCouple.user2_id] ?? '',
  }
  return {
    couple,
    members: [rawCouple.user1_id, rawCouple.user2_id].map((id) => ({ id, name: nameMap[id] ?? 'Alguien' })),
  }
})

export const getCoupleData = cache(async (coupleId: string): Promise<{
  couple: { id: string; user1_id: string; user2_id: string; monthly_budget: number; user1_name: string; user2_name: string } | null
  expenses: { id: string; amount: number; category: string; description: string | null; date: string; user_id: string | null; couple_id: string | null; created_by: string | null; created_at: string; is_income: boolean; createdByName: string | null }[]
  members: { id: string; name: string }[]
}> => {
  const { start, end } = currentMonthRange()

  const [metadata, expensesRes] = await Promise.all([
    getCoupleMetadata(coupleId),
    db.from('expenses').select('id, amount, category, description, date, user_id, couple_id, created_by, created_at, is_income').eq('couple_id', coupleId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  if (expensesRes.error) throw new Error('No se pudieron cargar los movimientos de pareja.')

  const couple = metadata?.couple ?? null
  const rawExpenses = (expensesRes.data ?? []) as { id: string; amount: number; category: string; description: string | null; date: string; user_id: string | null; couple_id: string | null; created_by: string | null; created_at: string; is_income: boolean }[]
  const nameMap = Object.fromEntries((metadata?.members ?? []).map((member) => [member.id, member.name]))

  return {
    couple: couple ? { ...couple, user1_name: nameMap[couple.user1_id] ?? '', user2_name: nameMap[couple.user2_id] ?? '' } : null,
    expenses: rawExpenses.map((e) => ({
      ...e,
      createdByName: e.created_by ? (nameMap[e.created_by] ?? null) : null,
    })),
    members: metadata?.members ?? [],
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
  const { data, error } = await db
    .from('expenses')
    .select('amount, date, is_income, couple_id, category')
    .or(ownMovementsFilter(userId))
    .gte('date', `${months[0].key}-01`)
  if (error) throw new Error('No se pudo cargar el historial individual.')

  const byMonth = new Map<string, { amount: number; is_income: boolean; category: string }[]>()
  for (const e of (data ?? []).filter(isOwnMovement)) {
    const key = e.date.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(e)
  }

  return months.map((m) => ({ ...m, ...movementTotals(byMonth.get(m.key) ?? []) }))
})

export const getCoupleHistory = cache(async (coupleId: string, monthlyBudget = 0, count = 6) => {
  const months = lastMonthsMeta(count)
  const start = `${months[0].key}-01`

  const { data, error } = await db.from('expenses').select('amount, date, is_income, created_by, category').eq('couple_id', coupleId).gte('date', start)
  if (error) throw new Error('No se pudo cargar el historial de pareja.')

  const expByMonth = new Map<string, { amount: number; is_income: boolean; created_by: string | null; category: string }[]>()
  for (const e of data ?? []) {
    const key = e.date.slice(0, 7)
    if (!expByMonth.has(key)) expByMonth.set(key, [])
    expByMonth.get(key)!.push(e)
  }

  return months.map((m) => {
    const rows = expByMonth.get(m.key) ?? []
    const { spent, income, extra } = movementTotals(rows)
    return { ...m, spent, income, extra, budget: monthlyBudget, fondo: monthlyBudget + income, byPerson: contributionTotals(rows) }
  })
})

// Referencias usadas recientemente (mías y de la pareja), para autocompletar al cargar.
export const getRecentDescriptions = cache(async (userId: string, coupleId: string | null) => {
  const filter = coupleId ? `${ownMovementsFilter(userId)},couple_id.eq.${coupleId}` : ownMovementsFilter(userId)
  const { data, error } = await db
    .from('expenses')
    .select('description')
    .or(filter)
    .not('description', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('No se pudieron cargar las referencias recientes.')
  return [...new Set((data ?? []).map((r) => r.description!.trim()).filter(Boolean))].slice(0, 50)
})

export const getExpenseForEdit = cache(async (id: string) => {
  const session = await verifySession()
  const { data, error } = await db.from('expenses').select('*').eq('id', id).single()
  if (error && error.code !== 'PGRST116') throw new Error('No se pudo cargar el movimiento.')
  if (!data) return null
  const canEdit = data.couple_id ? data.couple_id === session.coupleId : data.user_id === session.userId
  return canEdit ? data : null
})
