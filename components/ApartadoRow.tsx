import { formatUYU } from '@/lib/format'

// Lo que salió del bolsillo pero no es gasto del día a día: ahorro y viajes.
export default function ApartadoRow({ ahorro, viajes, metaAhorro }: { ahorro: number; viajes: number; metaAhorro?: number }) {
  if (ahorro === 0 && viajes === 0) return null
  return (
    <div className="flex justify-around text-xs text-gray-500 border-t border-gray-800 pt-3">
      <span>
        🐷 Ahorrado <span className="text-emerald-400 font-semibold">{formatUYU(ahorro)}</span>
        {metaAhorro ? <span className="text-gray-600"> / {formatUYU(metaAhorro)}</span> : null}
      </span>
      <span>✈️ Viajes <span className="text-sky-400 font-semibold">{formatUYU(viajes)}</span></span>
    </div>
  )
}
