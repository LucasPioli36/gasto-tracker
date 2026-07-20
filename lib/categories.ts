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
  { id: 'otros', label: 'Otros', icon: '📦' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function getCategoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
}

export function getCategoryIcon(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.icon ?? '📦'
}
