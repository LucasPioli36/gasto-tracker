export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Cargando pantalla" className="max-w-md mx-auto px-4 pt-6 pb-28">
      <div className="h-7 w-36 animate-pulse rounded bg-gray-800" />
      <div className="mt-6 h-36 animate-pulse rounded-2xl bg-gray-900" />
      <div className="mt-5 space-y-3" aria-hidden="true">
        <div className="h-20 animate-pulse rounded-xl bg-gray-900" />
        <div className="h-20 animate-pulse rounded-xl bg-gray-900" />
        <div className="h-20 animate-pulse rounded-xl bg-gray-900" />
      </div>
    </main>
  )
}
