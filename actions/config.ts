'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { db } from '@/lib/db'

export async function updateUserConfig(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await verifySession()

  const salary = parseFloat(formData.get('salary') as string)
  const savings_goal = parseFloat(formData.get('savings_goal') as string)

  if (isNaN(salary) || salary < 0) return 'Ingresá un sueldo válido'
  if (isNaN(savings_goal) || savings_goal < 0) return 'Ingresá una meta válida'
  if (savings_goal >= salary) return 'La meta de ahorro no puede superar el sueldo'

  await db.from('users').update({ salary, savings_goal }).eq('id', session.userId)
  revalidatePath('/home')
  revalidatePath('/individual')
  revalidatePath('/config')
  return null
}

export async function updateCoupleConfig(prevState: string | null, formData: FormData): Promise<string | null> {
  const session = await verifySession()
  if (!session.coupleId) return 'No tenés una cuenta de pareja'

  const monthly_budget = parseFloat(formData.get('monthly_budget') as string)
  if (isNaN(monthly_budget) || monthly_budget < 0) return 'Ingresá un presupuesto válido'

  await db.from('couple').update({ monthly_budget }).eq('id', session.coupleId)
  revalidatePath('/home')
  revalidatePath('/pareja')
  revalidatePath('/config')
  return null
}
