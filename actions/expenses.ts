'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'
import { MAX_INSTALLMENTS, installmentDescription, splitInstallments } from '@/lib/installments'
import { CATEGORIES } from '@/lib/categories'
import { todayInMontevideo } from '@/lib/investment-format'
import {
  fingerprintExpenseSubmission,
  hasExpenseSubmissionConflict,
  makeExpenseSubmissionKey,
  resolveExpenseSubmission,
} from '@/lib/expense-submission'

export type ExpenseFormState = {
  error?: string
  field?: 'amount' | 'date' | 'category' | 'description' | 'installments' | 'form'
  success?: string
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
    date: (formData.get('date') as string) || todayInMontevideo(),
    isIncome,
    paidBy: (formData.get('paid_by') as string) || null,
    confirmDuplicate: formData.get('confirm_duplicate') === '1',
    installments: isIncome ? 1 : Number(formData.get('installments') ?? 1),
    requestKey: String(formData.get('request_key') ?? ''),
  }
}

function validate(f: ReturnType<typeof parseForm>): ExpenseFormState {
  if (!Number.isFinite(f.amount) || f.amount <= 0) return { error: 'Ingresá un monto válido', field: 'amount' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !Number.isFinite(Date.parse(`${f.date}T00:00:00.000Z`)) || new Date(`${f.date}T00:00:00.000Z`).toISOString().slice(0, 10) !== f.date) return { error: 'Elegí una fecha válida', field: 'date' }
  if (!f.isIncome && !CATEGORIES.some(({ id }) => id === f.category)) return { error: 'Elegí una categoría válida', field: 'category' }
  if (!f.isIncome && f.category === 'otros' && !f.description) return { error: 'En "Otros" poné una referencia para saber qué fue', field: 'description' }
  if (!Number.isInteger(f.installments) || f.installments < 1 || f.installments > MAX_INSTALLMENTS) {
    return { error: `Las cuotas tienen que ser entre 1 y ${MAX_INSTALLMENTS}`, field: 'installments' }
  }
  return null
}

function validRequestKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
    if (!coupleId) return { duplicate: null }
    q = q.eq('couple_id', coupleId).eq('created_by', userId)
  } else {
    q = q.eq('user_id', userId)
  }
  if (excludeId) q = q.neq('id', excludeId)
  const { data, error } = await q.limit(1)
  if (error) return { lookupError: true as const }
  const match = data?.[0]
  return { duplicate: match ? { scope: tipo === 'individual' ? 'pareja' as const : 'individual' as const, description: match.description } : null }
}

function revalidateAll() {
  revalidatePath('/individual')
  revalidatePath('/pareja')
  revalidatePath('/home')
  revalidatePath('/metricas')
}

async function findSubmission(userId: string, requestKey: string) {
  const { data, error } = await db.from('expenses')
    .select('submission_key')
    .like('submission_key', `${requestKey}:%`)
    .or(`user_id.eq.${userId},created_by.eq.${userId}`)
    .limit(1)
    .maybeSingle()
  return { submissionKey: data?.submission_key ?? null, error }
}

export async function addExpense(prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const session = await verifySession()
  const f = parseForm(formData)

  const invalid = validate(f)
  if (invalid) return invalid
  if (!validRequestKey(f.requestKey)) return { error: 'No se pudo identificar este envío. Recargá el formulario e intentá de nuevo.', field: 'form' }
  if (f.tipo === 'pareja' && !session.coupleId) return { error: 'No tenés una cuenta de pareja configurada', field: 'form' }

  const fingerprint = fingerprintExpenseSubmission({
    userId: session.userId,
    tipo: f.tipo,
    coupleId: session.coupleId,
    isIncome: f.isIncome,
    amount: f.amount,
    category: f.category,
    description: f.description,
    date: f.date,
    installments: f.installments,
  })
  const { submissionKey: priorSubmission, error: priorSubmissionError } = await findSubmission(session.userId, f.requestKey)
  if (priorSubmissionError) return { error: 'No pudimos confirmar el estado del guardado. Conservamos el formulario; intentá de nuevo.', field: 'form' }
  const priorState = resolveExpenseSubmission(priorSubmission, f.requestKey, fingerprint)
  if (priorState === 'different') return { error: 'Esta clave ya se usó para guardar otros datos. Actualizá la lista o descartá el borrador antes de iniciar otro movimiento.', field: 'form' }
  if (priorState === 'same') {
    revalidateAll()
    return { success: f.tipo === 'pareja' ? '/pareja' : '/individual' }
  }

  // En cuotas, el monto ingresado es el total; se guarda una fila por mes.
  const cuotas = f.installments > 1
    ? splitInstallments(f.amount, f.installments, f.date).map((c) => ({
        amount: c.amount,
        date: c.date,
        description: installmentDescription(f.description, c.number, f.installments),
      }))
    : [{ amount: f.amount, date: f.date, description: f.description }]

  if (!f.isIncome && !f.confirmDuplicate) {
    const result = await findCrossScopeDuplicate(session.userId, session.coupleId, f.tipo, cuotas[0].date, cuotas[0].amount)
    if ('lookupError' in result) return { error: 'No pudimos comprobar duplicados. Revisá tu conexión e intentá de nuevo.', field: 'form' }
    if (result.duplicate) return { duplicate: result.duplicate }
  }

  const owner = f.tipo === 'pareja'
    ? { couple_id: session.coupleId as string, created_by: session.userId }
    : { user_id: session.userId }

  // Un solo INSERT con todas las filas: o se guardan todas las cuotas o ninguna.
  const { error } = await db.from('expenses').insert(cuotas.map((c, index) => ({
    ...owner,
    ...c,
    category: f.category,
    is_income: f.isIncome,
    submission_key: makeExpenseSubmissionKey(f.requestKey, fingerprint, index),
  })))
  if (hasExpenseSubmissionConflict(error)) {
    const { submissionKey, error: reconcileError } = await findSubmission(session.userId, f.requestKey)
    if (reconcileError) return { error: 'No pudimos confirmar si el guardado se completó. Conservamos el formulario; intentá de nuevo.', field: 'form' }
    if (resolveExpenseSubmission(submissionKey, f.requestKey, fingerprint) !== 'same') {
      return { error: 'No pudimos confirmar este guardado con los mismos datos. Conservamos el formulario; revisá el listado antes de reintentar.', field: 'form' }
    }
    revalidateAll()
    return { success: f.tipo === 'pareja' ? '/pareja' : '/individual' }
  }
  if (error) return { error: 'Error al guardar. Revisá tu conexión e intentá de nuevo.', field: 'form' }

  revalidateAll()
  return { success: f.tipo === 'pareja' ? '/pareja' : '/individual' }
}

// Edita una sola fila: en una compra en cuotas, solo esa cuota (ver TODO en lib/installments.ts).
export async function updateExpense(id: string, prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const session = await verifySession()
  const f = parseForm(formData)

  const invalid = validate(f)
  if (invalid) return invalid

  const { data: expense } = await db
    .from('expenses')
    .select('user_id, couple_id, created_by')
    .eq('id', id)
    .single()
  if (!expense) return { error: 'No se encontró el gasto', field: 'form' }
  const canEdit = expense.couple_id ? expense.couple_id === session.coupleId : expense.user_id === session.userId
  if (!canEdit) return { error: 'No podés editar este gasto', field: 'form' }

  let owner: { user_id: string | null; couple_id: string | null; created_by: string | null }
  if (f.tipo === 'pareja') {
    if (!session.coupleId) return { error: 'No tenés una cuenta de pareja configurada', field: 'form' }
    const { data: couple } = await db.from('couple').select('user1_id, user2_id').eq('id', session.coupleId).single()
    const members = couple ? [couple.user1_id, couple.user2_id] : []
    // Un gasto de pareja sin asignar (julio) no se asigna solo: hay que elegir quién pagó.
    const paidBy = f.paidBy ?? (expense.couple_id ? expense.created_by : session.userId)
    if (!paidBy || !members.includes(paidBy)) return { error: 'Elegí quién pagó', field: 'form' }
    owner = { user_id: null, couple_id: session.coupleId, created_by: paidBy }
  } else {
    // Pasar a "Yo" solo un gasto de pareja que pagué yo (o sin asignar).
    if (expense.couple_id && expense.created_by && expense.created_by !== session.userId) {
      return { error: 'Solo podés pasar a "Yo" un gasto que pagaste vos', field: 'form' }
    }
    owner = { user_id: session.userId, couple_id: null, created_by: null }
  }

  if (!f.isIncome && !f.confirmDuplicate) {
    const result = await findCrossScopeDuplicate(session.userId, session.coupleId, f.tipo, f.date, f.amount, id)
    if ('lookupError' in result) return { error: 'No pudimos comprobar duplicados. Revisá tu conexión e intentá de nuevo.', field: 'form' }
    if (result.duplicate) return { duplicate: result.duplicate }
  }

  const { data: updatedExpense, error } = await db.from('expenses').update({
    ...owner,
    amount: f.amount,
    category: f.category,
    description: f.description,
    date: f.date,
    is_income: f.isIncome,
  }).eq('id', id).select('id').maybeSingle()
  if (error || !updatedExpense) return { error: 'No se pudieron guardar los cambios. Revisá tu conexión e intentá de nuevo.', field: 'form' }

  revalidateAll()
  return { success: f.tipo === 'pareja' ? '/pareja' : '/individual' }
}

// Borra una sola fila: en una compra en cuotas, solo esa cuota (ver TODO en lib/installments.ts).
export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const session = await verifySession()

  const { data: expense } = await db
    .from('expenses')
    .select('user_id, couple_id')
    .eq('id', id)
    .single()

  if (!expense) return { error: 'No se encontró el movimiento. Actualizá la lista e intentá de nuevo.' }
  if (expense.couple_id) {
    if (expense.couple_id !== session.coupleId) return { error: 'No tenés permiso para eliminar este movimiento.' }
  } else {
    if (expense.user_id !== session.userId) return { error: 'No tenés permiso para eliminar este movimiento.' }
  }

  const { data, error } = await db.from('expenses').delete().eq('id', id).select('id').maybeSingle()
  if (error || !data) return { error: 'No se pudo eliminar el movimiento. Revisá tu conexión e intentá de nuevo.' }
  revalidateAll()
  return {}
}
