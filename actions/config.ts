'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'

export type ConfigActionState = { error?: string; success?: boolean } | null

export async function updateUserConfig(_prevState: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const session = await verifySession()

  const salary = parseFloat(formData.get('salary') as string)
  const savings_goal = parseFloat(formData.get('savings_goal') as string)

  if (!Number.isFinite(salary) || salary < 0) return { error: 'Ingresá un sueldo válido' }
  if (!Number.isFinite(savings_goal) || savings_goal < 0) return { error: 'Ingresá una meta válida' }
  if (savings_goal >= salary) return { error: 'La meta de ahorro no puede superar el sueldo' }

  const { data, error } = await db.from('users').update({ salary, savings_goal }).eq('id', session.userId).select('id').maybeSingle()
  if (error || !data) return { error: 'No se pudieron guardar tus finanzas. Revisá tu conexión e intentá de nuevo.' }
  revalidatePath('/home')
  revalidatePath('/individual')
  revalidatePath('/config')
  return { success: true }
}

export async function updateCoupleConfig(_prevState: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const session = await verifySession()
  if (!session.coupleId) return { error: 'No tenés una cuenta de pareja' }

  const monthly_budget = parseFloat(formData.get('monthly_budget') as string)
  if (!Number.isFinite(monthly_budget) || monthly_budget < 0) return { error: 'Ingresá un presupuesto válido' }

  const { data, error } = await db.from('couple').update({ monthly_budget }).eq('id', session.coupleId).select('id').maybeSingle()
  if (error || !data) return { error: 'No se pudo guardar el presupuesto. Revisá tu conexión e intentá de nuevo.' }
  revalidatePath('/home')
  revalidatePath('/pareja')
  revalidatePath('/config')
  return { success: true }
}
