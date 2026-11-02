import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const directory = path.join(repository, '.vercel/validation-20261102')

function parseCsv(text) {
  const rows = []
  let row = [], value = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(value); value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(value)
      if (row.some(field => field.length)) rows.push(row)
      row = []; value = ''
    } else {
      value += char
    }
  }
  if (value.length || row.length) { row.push(value); rows.push(row) }
  assert.equal(quoted, false, 'Unterminated CSV field')
  return rows
}

function readBackup(file) {
  let bytes = readFileSync(file)
  if (file.endsWith('.dpapi')) {
    assert.equal(process.platform, 'win32', 'DPAPI backups require the original Windows user profile.')
    const decrypt = [
      'Add-Type -AssemblyName System.Security',
      '$buffer=New-Object IO.MemoryStream',
      '[Console]::OpenStandardInput().CopyTo($buffer)',
      '$clear=[Security.Cryptography.ProtectedData]::Unprotect($buffer.ToArray(),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
      '[Console]::OpenStandardOutput().Write($clear,0,$clear.Length)',
    ].join('; ')
    bytes = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', decrypt], {
      input: bytes, windowsHide: true, maxBuffer: 50 * 1024 * 1024,
    })
  }
  const rows = parseCsv(bytes.toString('utf8').replace(/^\ufeff/, ''))
  assert.equal(rows.length, 2, 'Expected exactly one logical backup row')
  const payload = rows[1][rows[0].indexOf('backup_json')]
  const sourceMd5 = rows[1][rows[0].indexOf('source_md5')]
  assert.equal(createHash('md5').update(payload).digest('hex'), sourceMd5, 'Database source checksum mismatch')
  const backup = JSON.parse(payload)
  assert.equal(backup.format, 'gasto-tracker-public-backup-v1')
  const tables = Object.keys(backup.tables).sort()
  assert.deepEqual(tables, [...backup.table_inventory].sort(), 'Missing tables in logical snapshot')
  assert.deepEqual(tables, backup.table_definitions.map(definition => definition.name).sort(), 'Missing table definitions')
  for (const table of tables) assert.match(table, /^[a-z_][a-z0-9_]*$/)
  return { bytes, payload, backup, tables, sourceMd5 }
}

async function verify(file) {
  const snapshot = readBackup(file)
  const { payload, backup, tables } = snapshot
  // These object types are catalogued in the export, but a non-empty set needs
  // an explicit restoration implementation before this verifier can claim success.
  assert.equal(backup.sequences.length, 0, 'Sequence restoration requires an explicit implementation')
  assert.equal(backup.policies.length, 0, 'Policy restoration requires an explicit implementation')
  assert.equal(backup.triggers.length, 0, 'Trigger restoration requires an explicit implementation')
  const postgres = JSON.parse(readFileSync(path.join(directory, 'local-postgres.json'), 'utf8'))
  const connection = { host: '127.0.0.1', port: postgres.port, user: postgres.user,
    password: postgres.password, connectionTimeoutMillis: 10000 }
  const name = `gasto_tracker_test_restore_${Date.now()}`
  assert.match(name, /^gasto_tracker_test_restore_[0-9]+$/)
  const admin = new pg.Client({ ...connection, database: 'postgres' })
  await admin.connect()
  const expectedDataDirectory = path.join(directory, 'pgdata').toLowerCase()
  const actualDataDirectory = (await admin.query('SHOW data_directory')).rows[0].data_directory
  assert.equal(path.resolve(actualDataDirectory).toLowerCase(), expectedDataDirectory, 'Unexpected local cluster')
  await admin.query(`CREATE DATABASE "${name}"`)
  const client = new pg.Client({ ...connection, database: name })
  const report = { sourceChecksumVerified: true, payloadSha256: createHash('sha256').update(payload).digest('hex'),
    sourceVersion: backup.postgres_version, capturedAt: backup.captured_at, restoredTables: {}, migrationPreservesData: false }
  try {
    await client.connect()
    await client.query("SET TIME ZONE 'UTC'")
    await client.query('BEGIN')
    for (const definition of backup.table_definitions) await client.query(definition.ddl)
    for (const table of tables) {
      // Pass the original database text to PostgreSQL. Never reserialize the
      // parsed JS row data: doing so could round high-precision numeric values.
      await client.query(`INSERT INTO public."${table}" OVERRIDING SYSTEM VALUE
        SELECT * FROM jsonb_populate_recordset(NULL::public."${table}", $1::jsonb->'tables'->$2)`, [payload, table])
    }
    const constraints = [...backup.constraints].sort((a, b) => Number(/FOREIGN KEY/.test(a)) - Number(/FOREIGN KEY/.test(b)))
    for (const sql of constraints) await client.query(sql)
    for (const sql of backup.indexes) await client.query(sql)
    for (const sql of backup.functions) await client.query(sql)
    for (const setting of backup.rls) {
      assert.ok(tables.includes(setting.table))
      if (setting.enabled) await client.query(`ALTER TABLE public."${setting.table}" ENABLE ROW LEVEL SECURITY`)
      if (setting.forced) await client.query(`ALTER TABLE public."${setting.table}" FORCE ROW LEVEL SECURITY`)
    }
    await client.query('COMMIT')
    const columns = new Map()
    for (const table of tables) {
      columns.set(table, (await client.query(`SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table])).rows.map(row => row.column_name))
    }
    async function checkData() {
      for (const table of tables) {
        const actual = await client.query(`WITH projected AS (
          SELECT (SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(t)) WHERE key=ANY($3::text[])) AS row_data
          FROM public."${table}" t)
          SELECT coalesce(jsonb_agg(row_data ORDER BY row_data::text),'[]'::jsonb)=$1::jsonb->'tables'->$2 AS identical,
          count(*)::int AS rows FROM projected`, [payload, table, columns.get(table)])
        assert.equal(actual.rows[0].identical, true, `Restored records differ for ${table}`)
        report.restoredTables[table] = actual.rows[0].rows
      }
    }
    await checkData()
    const migration = readFileSync(path.join(repository, 'migrations/2026-11-01-expense-submission-idempotency.sql'), 'utf8')
    for (let run = 0; run < 2; run += 1) {
      await client.query('BEGIN')
      try { await client.query(migration); await client.query('COMMIT') } catch (error) { await client.query('ROLLBACK'); throw error }
      await checkData()
    }
    const indexes = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'
      AND indexname IN ('expenses_submission_key_unique_idx','expenses_submission_identity_unique_idx')`)
    assert.equal(indexes.rowCount, 2)
    report.migrationPreservesData = true
    report.migrationRuns = 2
    report.verifiedAt = new Date().toISOString()
    report.scope = 'Nine public tables, table definitions, constraints, indexes, functions and RLS flags; excludes Supabase platform auth/storage/configuration.'
    writeFileSync(path.join(directory, 'backups/restore-verification.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    await client.end()
    try { await admin.query(`DROP DATABASE "${name}"`) } finally { await admin.end() }
  }
}

const [command, file] = process.argv.slice(2)
if (command !== 'verify' || !file) throw new Error('Usage: node scripts/validation/public-backup.mjs verify <export.csv|export.csv.dpapi>')
verify(path.resolve(file)).catch(error => {
  // Report the affected object/operation, without dumping exported financial rows.
  console.error(error.message)
  process.exitCode = 1
})
