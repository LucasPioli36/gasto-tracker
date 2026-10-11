export const CATEGORIES = [
  { id: 'supermercado', label: 'Supermercado', icon: '🛒' },
  { id: 'comida', label: 'Comida', icon: '🍕' },
  { id: 'transporte', label: 'Transporte', icon: '🚗' },
  { id: 'salud', label: 'Salud', icon: '💊' },
  { id: 'ropa', label: 'Ropa', icon: '👕' },
  { id: 'entretenimiento', label: 'Diversion', icon: '🎬' },
  { id: 'servicios', label: 'Servicios', icon: '💡' },
  { id: 'hogar', label: 'Hogar', icon: '🏠' },
  { id: 'veterinario', label: 'Veterinario', icon: '🐾' },
  { id: 'peluqueria', label: 'Peluquería', icon: '💇' },
  { id: 'gimnasio', label: 'Gimnasio', icon: '🏋️' },
  { id: 'feria', label: 'Feria', icon: '🥦' },
  { id: 'empresa', label: 'Empresa', icon: '💼' },
  { id: 'key', label: 'Key', icon: '🔑' },
  { id: 'estacion', label: 'Estación', icon: '⛽' },
  { id: 'pedidosya', label: 'PedidosYa', icon: '🛵' },
  { id: 'otros', label: 'Otros', icon: '📦' },
  { id: 'ahorro', label: 'Ahorro', icon: '🐷', kind: 'ahorro' },
  { id: 'viajes', label: 'Viajes', icon: '✈️', kind: 'extraordinario' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function getCategoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
}

export function getCategoryIcon(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.icon ?? '📦'
}

// 'gasto' = día a día (cuenta para el límite y el ritmo del mes).
// 'ahorro' = plata que se aparta, no es gasto.
// 'extraordinario' = gasto real pero fuera del día a día (viajes).
export type CategoryKind = 'gasto' | 'ahorro' | 'extraordinario'

export function getCategoryKind(id: string): CategoryKind {
  const c = CATEGORIES.find((c) => c.id === id)
  return c && 'kind' in c ? c.kind : 'gasto'
}
