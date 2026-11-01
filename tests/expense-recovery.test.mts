import assert from 'node:assert/strict'
import test from 'node:test'
import { restoreExpenseRequestKey } from '../lib/expense-drafts.ts'
import {
  type ExpenseSubmissionFingerprintInput,
  fingerprintExpenseSubmission,
  hasExpenseSubmissionConflict,
  makeExpenseSubmissionIdentity,
  resolveExpenseSubmission,
  submitExpenseAtomically,
} from '../lib/expense-submission.ts'

const baseSubmission = {
  userId: 'user-a',
  tipo: 'individual' as const,
  coupleId: null,
  isIncome: false,
  amount: 100,
  category: 'comida',
  description: 'Almuerzo',
  date: '2026-11-01',
  installments: 1,
}

test('restoring a valid request key keeps it instead of generating a replacement', () => {
  let generated = 0
  const restored = restoreExpenseRequestKey({ requestKey: '3b12f1df-5232-4804-897e-917bf397618a' }, () => {
    generated += 1
    return 'new-id'
  })

  assert.equal(restored, '3b12f1df-5232-4804-897e-917bf397618a')
  assert.equal(generated, 0)
})

test('an invalid or missing draft key is replaced once by the caller supplied factory', () => {
  for (const draft of [null, {}, { requestKey: 'not-a-uuid' }]) {
    assert.equal(restoreExpenseRequestKey(draft, () => 'new-id'), 'new-id')
  }
})

test('submission fingerprints bind the user and every persisted form value', () => {
  const original = fingerprintExpenseSubmission(baseSubmission)
  assert.equal(fingerprintExpenseSubmission({ ...baseSubmission }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, amount: 250 }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, tipo: 'pareja', coupleId: 'couple-a' }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, userId: 'user-b' }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, installments: 3 }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, description: 'Otro' }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, category: 'transporte' }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, date: '2026-11-02' }), original)
  assert.notEqual(fingerprintExpenseSubmission({ ...baseSubmission, isIncome: true }), original)
})

test('only the identical request key and fingerprint reconcile as already saved', () => {
  const requestId = '3b12f1df-5232-4804-897e-917bf397618a'
  const original = fingerprintExpenseSubmission(baseSubmission)
  const existing = {
    identity: makeExpenseSubmissionIdentity(requestId, 0),
    fingerprint: original,
    userId: baseSubmission.userId,
  }

  assert.equal(resolveExpenseSubmission(existing, baseSubmission.userId, requestId, original), 'same')
  assert.equal(resolveExpenseSubmission(existing, baseSubmission.userId, requestId, fingerprintExpenseSubmission({ ...baseSubmission, amount: 250 })), 'different')
  assert.equal(resolveExpenseSubmission(existing, baseSubmission.userId, 'another-request-id', original), 'different')
  assert.equal(resolveExpenseSubmission(null, baseSubmission.userId, requestId, original), 'missing')
  assert.equal(resolveExpenseSubmission(existing, 'user-b', requestId, original), 'different')
})

test('only a unique constraint error enters idempotency reconciliation', () => {
  assert.equal(hasExpenseSubmissionConflict({ code: '23505' }), true)
  assert.equal(hasExpenseSubmissionConflict({ code: '08006' }), false)
  assert.equal(hasExpenseSubmissionConflict(null), false)
})

async function runConcurrentSubmissions(first: ExpenseSubmissionFingerprintInput, second: ExpenseSubmissionFingerprintInput) {
  const requestId = '3b12f1df-5232-4804-897e-917bf397618a'
  const rows: Array<{ userId: string; identity: string; fingerprint: string }> = []
  let firstReads = 0
  let releaseReads!: () => void
  const bothRead = new Promise<void>((resolve) => { releaseReads = resolve })

  function makeRequest(input: ExpenseSubmissionFingerprintInput) {
    const fingerprint = fingerprintExpenseSubmission(input)
    return submitExpenseAtomically({
      userId: input.userId,
      requestId,
      fingerprint,
      find: async () => {
        const existingRow = rows.find((row) => row.userId === input.userId && row.identity.startsWith(`${requestId}:`))
        firstReads += 1
        if (firstReads === 2) releaseReads()
        await bothRead
        return {
          existing: existingRow ?? null,
          error: null,
        }
      },
      insert: async () => {
        const identities = Array.from({ length: input.installments }, (_, index) => makeExpenseSubmissionIdentity(requestId, index))
        if (identities.some((identity) => rows.some((row) => row.userId === input.userId && row.identity === identity))) {
          return { error: { code: '23505' } }
        }
        rows.push(...identities.map((identity) => ({ userId: input.userId, identity, fingerprint })))
        return { error: null }
      },
    })
  }

  const results = await Promise.all([makeRequest(first), makeRequest(second)])
  return { results: results.map((result) => result.kind).sort(), rows }
}

test('concurrent identical submissions with one identity save a single row', async () => {
  const { results, rows } = await runConcurrentSubmissions(baseSubmission, { ...baseSubmission })

  assert.deepEqual(results, ['same', 'saved'])
  assert.equal(rows.length, 1)
})

test('concurrent changed amount or scope with one identity reject the losing submission', async () => {
  for (const changed of [
    { ...baseSubmission, amount: 250 },
    { ...baseSubmission, tipo: 'pareja' as const, coupleId: 'couple-a' },
  ]) {
    const { results, rows } = await runConcurrentSubmissions(baseSubmission, changed)
    assert.deepEqual(results, ['different', 'saved'])
    assert.equal(rows.length, 1)
  }
})

test('concurrent installment-count changes cannot insert a second batch', async () => {
  const { results, rows } = await runConcurrentSubmissions(baseSubmission, { ...baseSubmission, installments: 3 })

  assert.deepEqual(results, ['different', 'saved'])
  assert.ok(rows.length === 1 || rows.length === 3)
  assert.equal(new Set(rows.map((row) => row.userId)).size, 1)
})

test('the same request UUID is isolated by authenticated user identity', async () => {
  const { results, rows } = await runConcurrentSubmissions(baseSubmission, { ...baseSubmission, userId: 'user-b' })

  assert.deepEqual(results, ['saved', 'saved'])
  assert.equal(rows.length, 2)
  assert.deepEqual(new Set(rows.map((row) => row.userId)), new Set(['user-a', 'user-b']))
})
