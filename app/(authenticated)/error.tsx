'use client'

export default function AuthenticatedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28">
      <section role="alert" className="rounded-2xl border border-red-900 bg-gray-900 p-5">
        <h1 className="text-lg font-semibold text-white">No pudimos cargar esta pantalla</h1>
        <p className="mt-2 text-sm text-gray-300">Revisá tu conexión e intentá de nuevo. La navegación sigue disponible.</p>
        <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
          Reintentar
        </button>
      </section>
    </main>
  )
}
