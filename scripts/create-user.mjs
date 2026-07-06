/**
 * Uso: node scripts/create-user.mjs
 * Genera el SQL para crear un usuario con contraseña hasheada.
 * Pegar el output en el SQL Editor de Supabase.
 */

import { createRequire } from 'module'
import readline from 'readline'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

async function main() {
  console.log('\n=== Crear usuario ===\n')
  const username = (await ask('Username: ')).trim().toLowerCase()
  const name = (await ask('Nombre: ')).trim()
  const password = await ask('Contraseña: ')
  const salary = await ask('Sueldo (UYU, puede ser 0): ')
  const savings = await ask('Meta ahorro (UYU, puede ser 0): ')
  rl.close()

  const hash = await bcrypt.hash(password, 10)

  console.log('\n=== SQL para pegar en Supabase ===\n')
  console.log(`INSERT INTO users (username, name, password_hash, salary, savings_goal)`)
  console.log(`VALUES ('${username}', '${name}', '${hash}', ${Number(salary) || 0}, ${Number(savings) || 0});`)
  console.log('\n--- Para crear la pareja (después de crear los 2 usuarios) ---')
  console.log(`INSERT INTO couple (user1_id, user2_id, monthly_budget)`)
  console.log(`SELECT u1.id, u2.id, 0`)
  console.log(`FROM users u1, users u2`)
  console.log(`WHERE u1.username = 'USUARIO1' AND u2.username = 'USUARIO2';`)
}

main().catch(console.error)
