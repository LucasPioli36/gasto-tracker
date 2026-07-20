'use server'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/session'

export async function login(prevState: string | null, formData: FormData): Promise<string | null> {
  const username = (formData.get('username') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!username || !password) return 'Completá todos los campos'

  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (!user) return 'Usuario o contraseña incorrectos'

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return 'Usuario o contraseña incorrectos'

  const { data: couple } = await db
    .from('couple')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single()

  await createSession(user.id, couple?.id ?? null)
  redirect('/home')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
