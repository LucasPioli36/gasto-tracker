import assert from 'node:assert/strict'
import test from 'node:test'
import { restoreExpenseRequestKey } from '../lib/expense-drafts.ts'
import {
  fingerprintExpenseSubmission,
  hasExpenseSubmissionConflict,
  makeExpenseSubmissionKey,
  resolveExpenseSubmission,
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
})

test('only the identical request key and fingerprint reconcile as already saved', () => {
  const requestId = '3b12f1df-5232-4804-897e-917bf397618a'
  const original = fingerprintExpenseSubmission(baseSubmission)
  const storedKey = makeExpenseSubmissionKey(requestId, original, 0)

  assert.equal(resolveExpenseSubmission(storedKey, requestId, original), 'same')
  assert.equal(resolveExpenseSubmission(storedKey, requestId, fingerprintExpenseSubmission({ ...baseSubmission, amount: 250 })), 'different')
  assert.equal(resolveExpenseSubmission(storedKey, 'another-request-id', original), 'different')
  assert.equal(resolveExpenseSubmission(null, requestId, original), 'missing')
  assert.equal(resolveExpenseSubmission(`${requestId}:${original}:invalid`, requestId, original), 'different')
})

test('only a unique constraint error enters idempotency reconciliation', () => {
  assert.equal(hasExpenseSubmissionConflict({ code: '23505' }), true)
  assert.equal(hasExpenseSubmissionConflict({ code: '08006' }), false)
  assert.equal(hasExpenseSubmissionConflict(null), false)
})
