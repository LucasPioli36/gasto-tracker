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

export function makeExpenseSubmissionIdentity(requestId: string, index: number) {
  return `${requestId}:${index}`
}

export type ExistingExpenseSubmission = {
  identity: string
  fingerprint: string | null
  userId: string
} | null

export function resolveExpenseSubmission(
  existing: ExistingExpenseSubmission,
  userId: string,
  requestId: string,
  fingerprint: string,
) {
  if (!existing) return 'missing' as const
  const identityPrefix = `${requestId}:`
  return existing.userId === userId
    && existing.identity.startsWith(identityPrefix)
    && /^\d+$/.test(existing.identity.slice(identityPrefix.length))
    && existing.fingerprint === fingerprint
    ? 'same' as const
    : 'different' as const
}

export function hasExpenseSubmissionConflict(error: { code?: string } | null) {
  return error?.code === '23505'
}

export type ExpenseSubmissionResult<T> =
  | { kind: 'saved' }
  | { kind: 'same' }
  | { kind: 'different' }
  | { kind: 'failed' }
  | { kind: 'stopped'; value: T }

export async function submitExpenseAtomically<T>(input: {
  userId: string
  requestId: string
  fingerprint: string
  find: () => Promise<{ existing: ExistingExpenseSubmission; error: unknown | null }>
  beforeInsert?: () => Promise<{ continue: true } | { continue: false; value: T }>
  insert: () => Promise<{ error: { code?: string } | null }>
}): Promise<ExpenseSubmissionResult<T>> {
  const firstLookup = await input.find()
  if (firstLookup.error) return { kind: 'failed' }
  const initialState = resolveExpenseSubmission(firstLookup.existing, input.userId, input.requestId, input.fingerprint)
  if (initialState === 'same') return { kind: 'same' }
  if (initialState === 'different') return { kind: 'different' }

  if (input.beforeInsert) {
    const beforeInsert = await input.beforeInsert()
    if (!beforeInsert.continue) return { kind: 'stopped', value: beforeInsert.value }
  }

  const insertResult = await input.insert()
  if (!insertResult.error) return { kind: 'saved' }
  if (!hasExpenseSubmissionConflict(insertResult.error)) return { kind: 'failed' }

  const conflictLookup = await input.find()
  if (conflictLookup.error) return { kind: 'failed' }
  const conflictState = resolveExpenseSubmission(conflictLookup.existing, input.userId, input.requestId, input.fingerprint)
  return conflictState === 'same' ? { kind: 'same' } : { kind: 'different' }
}
