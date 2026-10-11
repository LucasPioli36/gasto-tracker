'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'
import { MAX_INSTALLMENTS, installmentDescription, splitInstallments } from '@/lib/installments'

export type ExpenseFormState = {
  error?: string
  // Posible duplicado en el otro ámbito: el form pide confirmación y reenvía con confirm_duplicate=1.
  duplicate?: { scope: 'individual' | 'pareja'; description: string | null }
} | null

type Tipo = 'individual' | 'pareja'

function parseForm(formData: FormData) {
  const isIncome = formData.get('is_income') === '1'
  return {
    amount: parseFloat(formData.get('amount') as string),
    category: (formData.get('category') as string) || (isIncome ? 'otros' : ''),
    description: (formData.get('description') as string)?.trim() || null,
    tipo: (formData.get('tipo') as Tipo) === 'pareja' ? 'pareja' as const : 'individual' as const,
    date: (formData.get('date') as string) || new Date().toISOString().split('T')[0],
    isIncome,
    paidBy: (formData.get('paid_by') as string) || null,
    confirmDuplicate: formData.get('confirm_duplicate') === '1',
    installments: isIncome ? 1 : Number(formData.get('installments') ?? 1),
  }
}

function validate(f: ReturnType<typeof parseForm>): string | null {
  if (!f.amount || f.amount <= 0) return 'Ingresá un monto válido'
  if (!f.isIncome && !f.category) return 'Elegí una categoría'
  if (!f.isIncome && f.category === 'otros' && !f.description) return 'En "Otros" poné una referencia para saber qué fue'
  if (!Number.isInteger(f.installments) || f.installments < 1 || f.installments > MAX_INSTALLMENTS) {
    return `Las cuotas tienen que ser entre 1 y ${MAX_INSTALLMENTS}`
  }
  return null
}

// Antes de PR #5 los gastos de la casa se cargaban dos veces (Yo + Pareja).
// Busca un gasto mío con la misma fecha y monto en el otro ámbito:
// WHERE date = :date AND amount = :amount AND NOT is_income AND (otro ámbito, cargado por mí)
async function findCrossScopeDuplicate(
  userId: string,
  coupleId: string | null,
  tipo: Tipo,
  date: string,
  amount: number,
  excludeId?: string,
) {
  let q = db.from('expenses').select('id, description').eq('date', date).eq('amount', amount).eq('is_income', false)
  if (tipo === 'individual') {
    if (!coupleId) return null
    q = q.eq('couple_id', coupleId).eq('created_by', userId)
  } else {
    q = q.eq('user_id', userId)
  }
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q.limit(1)
  const match = data?.[0]
  return match ? { scope: tipo === 'individual' ? 'pareja' as const : 'individual' as const, description: match.description } : null
}

function revalidateAll() {
  revalidatePath('/individual')
  revalidatePath('/pareja')
  revalidatePath('/home')
  revalidatePath('/metricas')
}

export async function addExpense(prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const session = await verifySession()
  const f = parseForm(formData)

  const invalid = validate(f)
  if (invalid) return { error: invalid }
  if (f.tipo === 'pareja' && !session.coupleId) return { error: 'No tenés una cuenta de pareja configurada' }

  // En cuotas, el monto ingresado es el total; se guarda una fila por mes.
  const cuotas = f.installments > 1
    ? splitInstallments(f.amount, f.installments, f.date).map((c) => ({
        amount: c.amount,
        date: c.date,
        description: installmentDescription(f.description, c.number, f.installments),
      }))
    : [{ amount: f.amount, date: f.date, description: f.description }]

  if (!f.isIncome && !f.confirmDuplicate) {
    const duplicate = await findCrossScopeDuplicate(session.userId, session.coupleId, f.tipo, cuotas[0].date, cuotas[0].amount)
    if (duplicate) return { duplicate }
  }

  const owner = f.tipo === 'pareja'
    ? { couple_id: session.coupleId as string, created_by: session.userId }
    : { user_id: session.userId }

  // Un solo INSERT con todas las filas: o se guardan todas las cuotas o ninguna.
  const { error } = await db.from('expenses').insert(cuotas.map((c) => ({
    ...owner,
    ...c,
    category: f.category,
    is_income: f.isIncome,
  })))
  if (error) return { error: 'Error al guardar. Intentá de nuevo.' }

  revalidateAll()
  redirect(f.tipo === 'pareja' ? '/pareja' : '/individual')
}

export async function updateExpense(id: string, prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const session = await verifySession()
  const f = parseForm(formData)

  const invalid = validate(f)
  if (invalid) return { error: invalid }

  const { data: expense } = await db
    .from('expenses')
    .select('user_id, couple_id, created_by')
    .eq('id', id)
    .single()
  if (!expense) return { error: 'No se encontró el gasto' }
  const canEdit = expense.couple_id ? expense.couple_id === session.coupleId : expense.user_id === session.userId
  if (!canEdit) return { error: 'No podés editar este gasto' }

  let owner: { user_id: string | null; couple_id: string | null; created_by: string | null }
  if (f.tipo === 'pareja') {
    if (!session.coupleId) return { error: 'No tenés una cuenta de pareja configurada' }
    const { data: couple } = await db.from('couple').select('user1_id, user2_id').eq('id', session.coupleId).single()
    const members = couple ? [couple.user1_id, couple.user2_id] : []
    // Un gasto de pareja sin asignar (julio) no se asigna solo: hay que elegir quién pagó.
    const paidBy = f.paidBy ?? (expense.couple_id ? expense.created_by : session.userId)
    if (!paidBy || !members.includes(paidBy)) return { error: 'Elegí quién pagó' }
    owner = { user_id: null, couple_id: session.coupleId, created_by: paidBy }
  } else {
    // Pasar a "Yo" solo un gasto de pareja que pagué yo (o sin asignar).
    if (expense.couple_id && expense.created_by && expense.created_by !== session.userId) {
      return { error: 'Solo podés pasar a "Yo" un gasto que pagaste vos' }
    }
    owner = { user_id: session.userId, couple_id: null, created_by: null }
  }

  if (!f.isIncome && !f.confirmDuplicate) {
    const duplicate = await findCrossScopeDuplicate(session.userId, session.coupleId, f.tipo, f.date, f.amount, id)
    if (duplicate) return { duplicate }
  }

  const { error } = await db.from('expenses').update({
    ...owner,
    amount: f.amount,
    category: f.category,
    description: f.description,
    date: f.date,
    is_income: f.isIncome,
  }).eq('id', id)
  if (error) return { error: 'Error al guardar. Intentá de nuevo.' }

  revalidateAll()
  redirect(f.tipo === 'pareja' ? '/pareja' : '/individual')
}

export async function deleteExpense(id: string) {
  const session = await verifySession()

  const { data: expense } = await db
    .from('expenses')
    .select('user_id, couple_id')
    .eq('id', id)
    .single()

  if (!expense) return
  if (expense.couple_id) {
    if (expense.couple_id !== session.coupleId) return
  } else {
    if (expense.user_id !== session.userId) return
  }

  await db.from('expenses').delete().eq('id', id)
  revalidateAll()
}
