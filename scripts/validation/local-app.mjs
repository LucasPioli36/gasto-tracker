import { randomBytes } from 'node:crypto'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const directory = path.resolve(repository, process.env.GASTO_VALIDATION_DIR ?? '.vercel/validation-20261102')
if (!directory.startsWith(path.join(repository, '.vercel') + path.sep)) throw new Error('Use the ignored validation directory.')
mkdirSync(directory, { recursive: true })
const postgres = JSON.parse(readFileSync(path.join(directory, 'local-postgres.json'), 'utf8'))
const configFile = path.join(directory, 'local-app.json')
const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {
  jwtSecret: randomBytes(32).toString('hex'),
  sessionSecret: randomBytes(32).toString('hex'),
  password: randomBytes(9).toString('base64url'),
  cronSecret: randomBytes(32).toString('hex'),
}
// Public fixture credential for synthetic accounts in the loopback test database.
// This value is never used to seed or authenticate a production account.
config.password = 'Validation-Only-2026'
config.serviceKey = await new SignJWT({ role: 'service_role', iss: 'gasto-tracker-local-validation' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt().setExpirationTime('7d')
  .sign(new TextEncoder().encode(config.jwtSecret))
writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 })

const database = 'gasto_tracker_test_app'
const connection = { host: '127.0.0.1', port: postgres.port, user: postgres.user,
  password: postgres.password, database, connectionTimeoutMillis: 10000 }
const databaseUrl = new URL('postgresql://127.0.0.1')
databaseUrl.port = String(postgres.port)
databaseUrl.username = postgres.user
databaseUrl.password = postgres.password
databaseUrl.pathname = `/${database}`
const pgBin = path.join(directory, 'tools/pgsql/bin')

// Explicit overrides prevent this local app from loading the production database
// and Google credentials present in the repository's existing .env.local.
const environment = {
  ...process.env,
  NODE_ENV: 'production',
  SUPABASE_URL: 'http://127.0.0.1:54742',
  SUPABASE_SERVICE_KEY: config.serviceKey,
  SESSION_SECRET: config.sessionSecret,
  GOOGLE_SHEETS_API_KEY: 'validation-unused',
  GOOGLE_SHEETS_SPREADSHEET_ID: 'validation-unused',
  CRON_SECRET: config.cronSecret,
  INVESTMENTS_OWNER_USERNAME: 'validation-a',
  VERCEL_ENV: 'preview',
  VERCEL_TARGET_ENV: 'preview',
  PATH: `${pgBin}${path.delimiter}${process.env.PATH}`,
}

async function seed() {
  const client = new pg.Client(connection)
  await client.connect()
  try {
    const identity = (await client.query('SELECT current_database() AS name')).rows[0].name
    if (identity !== database) throw new Error('Unexpected database; refusing to seed.')
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    END $$`)
    const exists = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'")
    if (exists.rowCount === 0) await client.query(readFileSync(path.join(repository, 'schema.sql'), 'utf8'))
    await client.query('GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role')
    const hash = await bcrypt.hash(config.password, 10)
    const users = [
      ['11111111-1111-4111-8111-111111111111', 'validation-a', 'Validation A', 100000, 20000],
      ['22222222-2222-4222-8222-222222222222', 'validation-b', 'Validation B', 80000, 15000],
      ['55555555-5555-4555-8555-555555555555', 'validation-solo', 'Validation Solo', 60000, 10000],
    ]
    for (const [id, username, name, salary, savings] of users) {
      await client.query(`INSERT INTO users(id,username,name,password_hash,salary,savings_goal) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(id) DO UPDATE SET password_hash=EXCLUDED.password_hash`, [id, username, name, hash, salary, savings])
    }
    await client.query(`INSERT INTO couple(id,user1_id,user2_id,monthly_budget) VALUES($1,$2,$3,40000) ON CONFLICT(id) DO NOTHING`,
      ['33333333-3333-4333-8333-333333333333', users[0][0], users[1][0]])
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const sample = await client.query("SELECT 1 FROM expenses WHERE description LIKE 'VALIDATION baseline%'")
    if (sample.rowCount === 0) {
      await client.query(`INSERT INTO expenses(user_id,amount,category,description,date) VALUES
        ($1,1000,'supermercado','VALIDATION baseline individual',$2),($3,300,'comida','VALIDATION baseline partner',$2)`, [users[0][0], date, users[1][0]])
      await client.query(`INSERT INTO expenses(couple_id,created_by,amount,category,description,date)
        VALUES($1,$2,1500,'servicios','VALIDATION baseline shared',$3)`, ['33333333-3333-4333-8333-333333333333', users[0][0], date])
    }
    await client.query(`INSERT INTO investment_portfolios(user_id,initial_invested_usd,initial_gain_usd,initial_date,units_owned,units_initialized)
      VALUES($1,9000,1000,$2,20,true) ON CONFLICT(user_id) DO NOTHING`, [users[0][0], date])
    await client.query(`INSERT INTO investment_price_snapshots(symbol,price_usd,trade_at,trading_date,source)
      VALUES('LON:CSPX',500,'Synthetic validation quote',$1,'synthetic-validation') ON CONFLICT(trading_date) DO NOTHING`, [date])
    console.log('Synthetic individual, couple and investment accounts are ready in the local test database.')
  } finally {
    await client.end()
  }
}

async function background(name, executable, args, env) {
  const log = openSync(path.join(directory, `${name}.log`), 'a')
  const child = spawn(executable, args, { cwd: repository, windowsHide: true, detached: true,
    env, stdio: ['ignore', log, log] })
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
  child.unref()
  closeSync(log)
  return child.pid
}

async function reachable(url, options = {}) {
  try { return (await fetch(url, { ...options, signal: AbortSignal.timeout(2000) })).ok } catch { return false }
}

async function waitFor(url, options) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await reachable(url, options)) return
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('A local validation service did not become ready; inspect its local log.')
}

async function main() {
  const command = process.argv[2] ?? 'start'
  await seed()
  if (command === 'build') {
    const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
      cwd: repository, env: environment, windowsHide: true, stdio: 'inherit', timeout: 240000,
    })
    process.exitCode = result.status ?? 1
    if (result.error) throw result.error
    if (result.status === 0) {
      config.buildCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8', windowsHide: true }).trim()
      writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 })
    }
    return
  }
  if (command !== 'start' && command !== 'seed') throw new Error('Use seed, build, or start.')
  if (command === 'seed') return
  if (!await reachable('http://127.0.0.1:54741/', { headers: { authorization: `Bearer ${config.serviceKey}` } })) {
    config.postgrestPid = await background('postgrest', path.join(directory, 'tools/postgrest/postgrest.exe'), [], {
      ...environment, PGRST_DB_URI: databaseUrl.href, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: config.jwtSecret, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: '54741',
    })
  }
  await waitFor('http://127.0.0.1:54741/', { headers: { authorization: `Bearer ${config.serviceKey}` } })
  if (!await reachable('http://127.0.0.1:54742/rest/v1/', { headers: { authorization: `Bearer ${config.serviceKey}` } })) {
    config.proxyPid = await background('rest-proxy', process.execPath, ['scripts/validation/rest-proxy.mjs'], environment)
  }
  await waitFor('http://127.0.0.1:54742/rest/v1/', { headers: { authorization: `Bearer ${config.serviceKey}` } })
  if (!existsSync(path.join(repository, '.next/BUILD_ID'))) throw new Error('Build the validation app before starting it.')
  if (!await reachable('http://127.0.0.1:3005/login')) {
    config.nextPid = await background('next', process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3005'], environment)
  }
  await waitFor('http://127.0.0.1:3005/login')
  writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 })
  console.log(JSON.stringify({ app: 'http://localhost:3005', database, postgrest: '16.5', syntheticOnly: true,
    accountNames: ['validation-a', 'validation-b', 'validation-solo'], credentialsFile: configFile }))
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
