import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import {
  fingerprintExpenseSubmission,
  makeExpenseSubmissionIdentity,
  makeExpenseSubmissionKey,
  submitExpenseAtomically,
} from '../lib/expense-submission.ts'
import { splitInstallments } from '../lib/installments.ts'

const databaseUrl = process.env.TEST_DATABASE_URL
assert.ok(databaseUrl, 'Set TEST_DATABASE_URL to a disposable local PostgreSQL database.')
const database = new URL(databaseUrl)
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname), 'Integration tests accept loopback PostgreSQL only.')
assert.match(database.pathname, /^\/gasto_tracker_test_[a-z0-9_]+$/, 'Use a database named gasto_tracker_test_*.')

const migration = await readFile(new URL('../migrations/2026-11-01-expense-submission-idempotency.sql', import.meta.url), 'utf8')
const legacySchema = await readFile(new URL('./fixtures/expenses-before-safari.sql', import.meta.url), 'utf8')
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const COUPLE = '33333333-3333-4333-8333-333333333333'
const REQUEST = '44444444-4444-4444-8444-444444444444'
const baseSubmission = {
  userId: USER_A,
  tipo: 'individual',
  coupleId: COUPLE,
  isIncome: false,
  amount: 100,
  category: 'comida',
  description: 'Synthetic integration expense',
  date: '2026-11-02',
  installments: 1,
}

async function fixture(run) {
  const schema = `validation_${randomUUID().replaceAll('-', '')}`
  assert.match(schema, /^validation_[a-f0-9]{32}$/)
  const admin = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 })
  await admin.connect()
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 8,
    connectionTimeoutMillis: 10000,
    options: `-c search_path=${schema},public -c statement_timeout=15000 -c lock_timeout=10000`,
  })
  async function migrate() {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(migration)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  try {
    await pool.query(legacySchema)
    await pool.query(
      'INSERT INTO users(id,username,name,password_hash) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',
      [USER_A, 'validation-a', 'Validation A', 'not-a-real-password', USER_B, 'validation-b', 'Validation B', 'not-a-real-password'],
    )
    await pool.query('INSERT INTO couple(id,user1_id,user2_id,monthly_budget) VALUES($1,$2,$3,1000)', [COUPLE, USER_A, USER_B])
    return await run({ pool, migrate, schema })
  } finally {
    await pool.end()
    try {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
    } finally {
      await admin.end()
    }
  }
}

async function insertBatch(pool, input, requestId = REQUEST) {
  const fingerprint = fingerprintExpenseSubmission(input)
  const installments = splitInstallments(input.amount, input.installments, input.date)
  const rows = installments.map((part, index) => ({
    user_id: input.tipo === 'individual' ? input.userId : null,
    couple_id: input.tipo === 'pareja' ? input.coupleId : null,
    created_by: input.tipo === 'pareja' ? input.userId : null,
    amount: part.amount,
    category: input.category,
    description: input.description,
    date: part.date,
    is_income: input.isIncome,
    submission_key: makeExpenseSubmissionKey(requestId, fingerprint, index),
    submission_identity: makeExpenseSubmissionIdentity(requestId, index),
    submission_fingerprint: fingerprint,
    submission_user_id: input.userId,
  }))
  try {
    await pool.query(`
      INSERT INTO expenses(user_id,couple_id,created_by,amount,category,description,date,is_income,
        submission_key,submission_identity,submission_fingerprint,submission_user_id)
      SELECT user_id,couple_id,created_by,amount,category,description,date,is_income,
        submission_key,submission_identity,submission_fingerprint,submission_user_id
      FROM jsonb_to_recordset($1::jsonb) AS x(
        user_id uuid,couple_id uuid,created_by uuid,amount numeric,category text,description text,
        date date,is_income boolean,submission_key text,submission_identity text,
        submission_fingerprint text,submission_user_id uuid)
    `, [JSON.stringify(rows)])
    return { error: null }
  } catch (error) {
    return { error: { code: error.code, message: error.message } }
  }
}

async function concurrent(pool, first, second) {
  let reads = 0
  let release
  const bothRead = new Promise(resolve => { release = resolve })
  function request(input) {
    return submitExpenseAtomically({
      userId: input.userId,
      requestId: REQUEST,
      fingerprint: fingerprintExpenseSubmission(input),
      find: async () => {
        const result = await pool.query(`
          SELECT submission_identity AS identity,submission_fingerprint AS fingerprint,submission_user_id AS "userId"
          FROM expenses WHERE submission_user_id=$1 AND submission_identity LIKE $2 LIMIT 1
        `, [input.userId, `${REQUEST}:%`])
        reads += 1
        if (reads <= 2) {
          if (reads === 2) release()
          await bothRead
        }
        return { existing: result.rows[0] ?? null, error: null }
      },
      insert: () => insertBatch(pool, input),
    })
  }
  return Promise.all([request(first), request(second)])
}

test('PostgreSQL migration preserves legacy amounts and creates the stable unique index', { timeout: 30000 }, async () => {
  await fixture(async ({ pool, migrate, schema }) => {
    await pool.query('INSERT INTO expenses(user_id,amount,category,description,date) VALUES($1,123.45,$2,$3,$4)', [USER_A, 'comida', 'Legacy fixture', '2026-10-01'])
    const before = await pool.query('SELECT id,user_id,amount,category,description,date::text FROM expenses')
    await migrate()
    const after = await pool.query('SELECT id,user_id,amount,category,description,date::text FROM expenses')
    assert.deepEqual(after.rows, before.rows)
    const indexes = await pool.query('SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname=$2', [schema, 'expenses_submission_identity_unique_idx'])
    assert.equal(indexes.rowCount, 1)
    assert.match(indexes.rows[0].indexdef, /UNIQUE INDEX/)
    assert.match(indexes.rows[0].indexdef, /submission_user_id, submission_identity/)
  })
})

test('migration rerun preserves submitter, identity and fingerprint after payer changes', { timeout: 30000 }, async () => {
  await fixture(async ({ pool, migrate }) => {
    await pool.query('ALTER TABLE expenses ADD COLUMN submission_key text')
    const fingerprint = fingerprintExpenseSubmission({ ...baseSubmission, tipo: 'pareja' })
    await pool.query(`INSERT INTO expenses(couple_id,created_by,amount,category,submission_key)
      VALUES($1,$2,100,'comida',$3)`, [COUPLE, USER_A, makeExpenseSubmissionKey(REQUEST, fingerprint, 0)])
    await migrate()
    const before = await pool.query('SELECT submission_user_id,submission_identity,submission_fingerprint FROM expenses')
    assert.equal(before.rows[0].submission_user_id, USER_A)
    await pool.query('UPDATE expenses SET created_by=$1', [USER_B])
    await migrate()
    const after = await pool.query('SELECT submission_user_id,submission_identity,submission_fingerprint FROM expenses')
    assert.deepEqual(after.rows, before.rows)
  })
})

test('unknown historic request keys abort the migration without changing legacy data', { timeout: 30000 }, async () => {
  await fixture(async ({ pool, migrate, schema }) => {
    await pool.query('ALTER TABLE expenses ADD COLUMN submission_key text')
    await pool.query("INSERT INTO expenses(user_id,amount,category,submission_key) VALUES($1,75,'comida','unknown-key')", [USER_A])
    await assert.rejects(migrate, /Cannot safely backfill/)
    const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='expenses' AND column_name='submission_identity'", [schema])
    assert.equal(columns.rowCount, 0)
    assert.equal((await pool.query('SELECT amount FROM expenses')).rows[0].amount, '75.00')
  })
})

test('historic duplicate identities abort without deleting either expense', { timeout: 30000 }, async () => {
  await fixture(async ({ pool, migrate }) => {
    await pool.query('ALTER TABLE expenses ADD COLUMN submission_key text')
    for (const amount of [100, 250]) {
      const fingerprint = fingerprintExpenseSubmission({ ...baseSubmission, amount })
      await pool.query("INSERT INTO expenses(user_id,amount,category,submission_key) VALUES($1,$2,'comida',$3)", [USER_A, amount, makeExpenseSubmissionKey(REQUEST, fingerprint, 0)])
    }
    await assert.rejects(migrate, /Duplicate expense submission identities/)
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM expenses')).rows[0].count, 2)
  })
})

for (const count of [1, 3]) {
  test(`identical concurrent submissions save one PostgreSQL batch of ${count} installment(s)`, { timeout: 30000 }, async () => {
    await fixture(async ({ pool, migrate }) => {
      await migrate()
      const input = { ...baseSubmission, installments: count }
      const results = await concurrent(pool, input, { ...input })
      assert.deepEqual(results.map(result => result.kind).sort(), ['same', 'saved'])
      const actual = await pool.query('SELECT count(*)::int AS count,sum(amount)::text AS total FROM expenses')
      assert.deepEqual(actual.rows[0], { count, total: '100.00' })
    })
  })
}

for (const [label, change] of [
  ['amount', { amount: 250 }],
  ['scope', { tipo: 'pareja' }],
  ['installments', { installments: 3 }],
]) {
  test(`concurrent ${label} changes cannot create a second PostgreSQL batch`, { timeout: 30000 }, async () => {
    await fixture(async ({ pool, migrate }) => {
      await migrate()
      const results = await concurrent(pool, baseSubmission, { ...baseSubmission, ...change })
      assert.deepEqual(results.map(result => result.kind).sort(), ['different', 'saved'])
      const stored = await pool.query('SELECT count(*)::int AS count,count(DISTINCT submission_fingerprint)::int AS fingerprints FROM expenses')
      assert.equal(stored.rows[0].fingerprints, 1)
      assert.ok([1, change.installments ?? 1].includes(stored.rows[0].count))
    })
  })
}

test('the same UUID remains independent for two authenticated submitters in PostgreSQL', { timeout: 30000 }, async () => {
  await fixture(async ({ pool, migrate }) => {
    await migrate()
    const results = await concurrent(pool, baseSubmission, { ...baseSubmission, userId: USER_B })
    assert.deepEqual(results.map(result => result.kind), ['saved', 'saved'])
    const users = await pool.query('SELECT submission_user_id FROM expenses ORDER BY submission_user_id')
    assert.deepEqual(users.rows.map(row => row.submission_user_id), [USER_A, USER_B])
  })
})

test('an insert conflict rolls back every row of an installment batch', { timeout: 30000 }, async () => {
  await fixture(async ({ pool, migrate }) => {
    await migrate()
    const first = { ...baseSubmission, installments: 3 }
    assert.equal((await insertBatch(pool, first)).error, null)
    const second = await insertBatch(pool, { ...first, installments: 6, amount: 250 })
    assert.equal(second.error.code, '23505')
    const stored = await pool.query('SELECT count(*)::int AS count,sum(amount)::text AS total FROM expenses')
    assert.deepEqual(stored.rows[0], { count: 3, total: '100.00' })
  })
})
