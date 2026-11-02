import { randomBytes } from 'node:crypto'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const directory = path.resolve(repository, process.env.GASTO_VALIDATION_DIR ?? '.vercel/validation-20261102')
const allowedRoot = path.join(repository, '.vercel') + path.sep
if (!directory.startsWith(allowedRoot)) throw new Error('Validation files must stay inside the ignored .vercel directory.')
mkdirSync(directory, { recursive: true })
const configFile = path.join(directory, 'local-postgres.json')
const bin = path.join(directory, 'tools/pgsql/bin')
const dataDirectory = path.join(directory, 'pgdata')
const port = 54740

function localConfig() {
  if (existsSync(configFile)) return JSON.parse(readFileSync(configFile, 'utf8'))
  const config = { user: 'gasto_test_admin', password: randomBytes(24).toString('hex'), port }
  writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 })
  return config
}

function connection(config, database = 'postgres') {
  if (database !== 'postgres' && !/^gasto_tracker_test_[a-z0-9_]+$/.test(database)) {
    throw new Error('Only disposable validation databases are supported.')
  }
  return {
    host: '127.0.0.1',
    port: config.port,
    user: config.user,
    password: config.password,
    database,
    connectionTimeoutMillis: 10000,
  }
}

function run(name, args) {
  return execFileSync(path.join(bin, `${name}.exe`), args, {
    cwd: repository,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  })
}

async function setup() {
  if (process.platform !== 'win32') throw new Error('This portable launcher is for Windows; integration tests also accept other loopback PostgreSQL servers.')
  if (!existsSync(path.join(bin, 'initdb.exe'))) throw new Error('Extract the official PostgreSQL binaries into the ignored validation tools directory first.')
  const config = localConfig()
  if (!existsSync(path.join(dataDirectory, 'PG_VERSION'))) {
    const passwordFile = path.join(directory, 'local-postgres-password.txt')
    writeFileSync(passwordFile, config.password, { mode: 0o600 })
    console.log('Initializing disposable PostgreSQL cluster with synthetic data only.')
    run('initdb', ['-D', dataDirectory, '-U', config.user, '--pwfile', passwordFile,
      '--auth-host=scram-sha-256', '--auth-local=trust', '--encoding=UTF8', '--locale=C'])
  }
  async function responds() {
    const probe = new pg.Client({ ...connection(config), connectionTimeoutMillis: 1500 })
    try {
      await probe.connect()
      return true
    } catch {
      return false
    } finally {
      await probe.end().catch(() => {})
    }
  }
  if (!await responds()) {
    console.log('Starting disposable PostgreSQL on loopback port 54740.')
    const log = openSync(path.join(directory, 'postgres.log'), 'a')
    const server = spawn(path.join(bin, 'postgres.exe'), ['-D', dataDirectory, '-h', '127.0.0.1',
      '-p', String(config.port), '-c', 'max_connections=30', '-c', 'shared_buffers=64MB'], {
      cwd: repository, windowsHide: true, detached: true, stdio: ['ignore', log, log],
    })
    await new Promise((resolve, reject) => { server.once('spawn', resolve); server.once('error', reject) })
    server.unref()
    closeSync(log)
    let ready = false
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await responds()) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (!ready) throw new Error('Disposable PostgreSQL did not become ready; inspect the local validation log.')
  }
  const client = new pg.Client(connection(config))
  await client.connect()
  try {
    const actualDirectory = (await client.query('SHOW data_directory')).rows[0].data_directory
    if (path.resolve(actualDirectory).toLowerCase() !== dataDirectory.toLowerCase()) throw new Error('Unexpected PostgreSQL cluster; refusing to create test databases.')
    for (const database of ['gasto_tracker_test_validation', 'gasto_tracker_test_app']) {
      const existing = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])
      if (existing.rowCount === 0) await client.query(`CREATE DATABASE "${database}"`)
    }
    const version = (await client.query('SHOW server_version')).rows[0].server_version
    console.log(JSON.stringify({ postgres: version, host: '127.0.0.1', port: config.port, database: 'gasto_tracker_test_validation', syntheticOnly: true }))
  } finally {
    await client.end()
  }
  return config
}

async function main() {
  const command = process.argv[2] ?? 'setup'
  if (command === 'stop') {
    run('pg_ctl', ['stop', '-D', dataDirectory, '-m', 'fast', '-w', '-t', '30'])
    console.log('Disposable PostgreSQL stopped; validation files retained locally.')
    return
  }
  const config = await setup()
  if (command === 'test') {
    const url = new URL('postgresql://127.0.0.1')
    url.port = String(config.port)
    url.username = config.user
    url.password = config.password
    url.pathname = '/gasto_tracker_test_validation'
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/expense-postgres.integration.test.mjs'], {
      cwd: repository,
      windowsHide: true,
      stdio: 'inherit',
      env: { ...process.env, TEST_DATABASE_URL: url.href },
      timeout: 180000,
    })
    process.exitCode = result.status ?? 1
    if (result.error) throw result.error
  } else if (command !== 'setup') {
    throw new Error('Use setup, test, or stop.')
  }
}

main().catch(error => {
  console.error(error.message)
  if (error.stderr) console.error(String(error.stderr))
  process.exitCode = 1
})
