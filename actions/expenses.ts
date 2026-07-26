'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'

export async function addExpense(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await verifySession()

  const amount = parseFloat(formData.get('amount') as string)
  const category = (formData.get('category') as string) || 'otros'
  const description = (formData.get('description') as string)?.trim()
  const tipo = formData.get('tipo') as 'individual' | 'pareja'
  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0]
  const isIncome = formData.get('is_income') === '1'

  if (!amount || amount <= 0) return 'Ingresá un monto válido'
  if (!isIncome && !category) return 'Elegí una categoría'

  if (tipo === 'pareja') {
    if (!session.coupleId) return 'No tenés una cuenta de pareja configurada'
    const { error: errPar } = await db.from('expenses').insert({
      couple_id: session.coupleId,
      created_by: session.userId,
      amount,
      category,
      description: description || null,
      date,
      is_income: isIncome,
    })
    if (errPar) return 'Error al guardar. Intentá de nuevo.'
    revalidatePath('/pareja')
  } else {
    const { error: errInd } = await db.from('expenses').insert({
      user_id: session.userId,
      amount,
      category,
      description: description || null,
      date,
      is_income: isIncome,
    })
    if (errInd) return 'Error al guardar. Intentá de nuevo.'
    revalidatePath('/individual')
  }

  revalidatePath('/home')
  redirect(tipo === 'pareja' ? '/pareja' : '/individual')
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
  revalidatePath('/individual')
  revalidatePath('/pareja')
  revalidatePath('/home')
}

export async function addDeposit(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await verifySession()
  if (!session.coupleId) return 'No tenés una cuenta de pareja'

  const amount = parseFloat(formData.get('amount') as string)
  if (!amount || amount <= 0) return 'Ingresá un monto válido'

  const date = (formData.get('date') as string) || new Date().toISOString().split('T')[0]

  await db.from('couple_deposits').insert({
    couple_id: session.coupleId,
    user_id: session.userId,
    amount,
    date,
  })

  revalidatePath('/pareja')
  revalidatePath('/home')
  return null
}
