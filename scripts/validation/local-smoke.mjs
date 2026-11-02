import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SignJWT } from 'jose'
import pg from 'pg'

const root = fileURLToPath(new URL('../../', import.meta.url))
const directory = path.join(root, '.vercel/validation-20261102')
const config = JSON.parse(readFileSync(path.join(directory, 'local-app.json'), 'utf8'))
const postgres = JSON.parse(readFileSync(path.join(directory, 'local-postgres.json'), 'utf8'))
const base = 'http://localhost:3005'
const coupleId = '33333333-3333-4333-8333-333333333333'
const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'
const solo = '55555555-5555-4555-8555-555555555555'
const checks = []
async function session(userId, couple = coupleId, expiration = '5m') {
  return new SignJWT({ userId, coupleId: couple, expiresAt: new Date(Date.now() + 300000).toISOString() })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiration)
    .sign(new TextEncoder().encode(config.sessionSecret))
}
async function get(route, token) {
  return fetch(`${base}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: token ? { cookie: `session=${token}` } : {} })
}
function passed(name) { checks.push(name); console.log(`PASS ${name}`) }
async function denied(route, token, privateText) {
  const response = await get(route, token)
  const html = await response.text()
  // App Router can stream its shell with HTTP 200 before resolving notFound().
  assert.ok(response.status === 404 || html.includes('NEXT_HTTP_ERROR_FALLBACK;404'), `Missing notFound: ${route}`)
  if (privateText) assert.ok(!html.includes(privateText), `Private content leaked: ${route}`)
}
const a = await session(userA)
const b = await session(userB)
const s = await session(solo, null)
const client = new pg.Client({ host: '127.0.0.1', port: postgres.port, user: postgres.user,
  password: postgres.password, database: 'gasto_tracker_test_app', connectionTimeoutMillis: 10000 })
await client.connect()
try {
  assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'gasto_tracker_test_app')
  const expenses = (await client.query("SELECT *, date::text AS date FROM expenses WHERE description LIKE 'VALIDATION %'")).rows
  const ownExpense = expenses.find(row => row.description === 'VALIDATION baseline individual')
  for (const route of ['/home', '/individual', '/pareja', '/agregar', '/config', '/metricas', '/inversiones']) {
    const anonymous = await get(route)
    assert.ok([303, 307, 308].includes(anonymous.status), `${route}: ${anonymous.status}`)
    assert.equal(new URL(anonymous.headers.get('location'), base).pathname, '/login')
    assert.equal((await get(route, a)).status, 200, route)
  }
  passed('Protected pages reject anonymous access and load for the owner')
  for (const token of [undefined, 'invalid', await session(userA, coupleId, Math.floor(Date.now() / 1000) - 60)]) {
    assert.equal((await get('/api/expenses/suggestions', token)).status, 401)
  }
  passed('Suggestions reject missing, invalid and expired sessions')
  const suggestions = await (await get('/api/expenses/suggestions', a)).json()
  assert.ok(suggestions.suggestions.includes('VALIDATION baseline individual'))
  assert.ok(!suggestions.suggestions.includes('VALIDATION baseline partner'))
  passed('Authenticated suggestions exclude the partner private expenses')
  assert.equal((await get(`/editar/${ownExpense.id}`, a)).status, 200)
  await denied(`/editar/${ownExpense.id}`, b, ownExpense.description)
  await denied(`/editar/${ownExpense.id}`, s, ownExpense.description)
  for (const token of [b, s]) await denied('/inversiones', token, 'Saldo inicial')
  passed('Private editing and investments enforce ownership on the server')
  const soloHtml = await (await get('/home', s)).text()
  assert.ok(!soloHtml.includes('href="/inversiones"'))
  assert.ok(!soloHtml.includes('VALIDATION baseline partner'))
  assert.equal((await get('/api/expenses/suggestions', s)).status, 200)
  passed('The standalone account loads without a couple and without investment navigation')
  const installments = expenses.filter(row => row.description?.startsWith('VALIDATION browser installments'))
  assert.equal(installments.length, 3)
  assert.equal(installments.reduce((sum, row) => sum + Number(row.amount), 0), 300)
  assert.equal(new Set(installments.map(row => row.date.slice(0, 7))).size, 3)
  assert.ok(installments.every(row => row.couple_id === coupleId && row.created_by === userA && row.submission_identity))
  assert.equal(expenses.filter(row => row.description === 'VALIDATION browser income' && row.is_income && Number(row.amount) === 50).length, 1)
  assert.ok(!expenses.some(row => row.description === 'VALIDATION browser edited'))
  passed('Browser writes persisted: 3 monthly installments, one income and deleted edited expense')
  const measurements = []
  for (const route of ['/individual', '/pareja', '/agregar', '/metricas', '/config']) {
    await (await get(route, a)).arrayBuffer()
    const samples = []
    for (let i = 0; i < 10; i += 1) {
      const start = performance.now()
      const response = await get(route, a)
      assert.equal(response.status, 200)
      const headersMs = performance.now() - start
      const body = await response.arrayBuffer()
      samples.push({ headersMs, fullMs: performance.now() - start, bytes: body.byteLength })
    }
    const ordered = samples.map(row => row.fullMs).sort((x, y) => x - y)
    measurements.push({ route, samples: samples.length, medianFullMs: Math.round(ordered[5]), p90FullMs: Math.round(ordered[8]),
      medianHeadersMs: Math.round(samples.map(row => row.headersMs).sort((x, y) => x - y)[5]), bytes: samples[0].bytes })
  }
  const result = { testedAt: new Date().toISOString(), checks, measurements,
    limitation: 'Loopback HTTP with a local production build and synthetic data. Not Safari interaction latency or a before/after production benchmark.' }
  writeFileSync(path.join(directory, 'local-smoke-results.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ checksPassed: checks.length, measurements, limitation: result.limitation }, null, 2))
} finally { await client.end() }
