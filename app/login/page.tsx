'use client'
import { useActionState } from 'react'
import { login } from '@/actions/auth'

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">💸</div>
          <h1 className="text-3xl font-bold text-white">Gastos</h1>
          <p className="text-gray-500 mt-2 text-sm">Tracker de gastos</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400 font-medium" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              required
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition-colors text-base"
              placeholder="tu usuario"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400 font-medium" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition-colors text-base"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-950/50 rounded-xl py-2.5 px-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-base transition-colors"
          >
            {pending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
