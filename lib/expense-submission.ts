import { createHash } from 'node:crypto'

export type ExpenseSubmissionFingerprintInput = {
  userId: string
  tipo: 'individual' | 'pareja'
  coupleId: string | null
  isIncome: boolean
  amount: number
  category: string
  description: string | null
  date: string
  installments: number
}

export function fingerprintExpenseSubmission(input: ExpenseSubmissionFingerprintInput) {
  const canonicalPayload = [
    input.userId,
    input.tipo,
    input.tipo === 'pareja' ? input.coupleId : null,
    input.isIncome,
    input.amount,
    input.category,
    input.description,
    input.date,
    input.installments,
  ]
  return createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex')
}

export function makeExpenseSubmissionKey(requestId: string, fingerprint: string, index: number) {
  return `${requestId}:${fingerprint}:${index}`
}

export function matchesExpenseSubmissionKey(value: string | null, requestId: string, fingerprint: string) {
  if (!value) return false
  const prefix = `${requestId}:`
  if (!value.startsWith(prefix)) return false
  const parts = value.slice(prefix.length).split(':')
  if (parts.length !== 2) return false
  const storedFingerprint = parts[0]
  const index = parts[1]
  return /^[a-f0-9]{64}$/i.test(storedFingerprint)
    && storedFingerprint === fingerprint
    && /^\d+$/.test(index)
}

export function resolveExpenseSubmission(value: string | null, requestId: string, fingerprint: string) {
  if (!value) return 'missing' as const
  return matchesExpenseSubmissionKey(value, requestId, fingerprint) ? 'same' as const : 'different' as const
}

export function hasExpenseSubmissionConflict(error: { code?: string } | null) {
  return error?.code === '23505'
}
