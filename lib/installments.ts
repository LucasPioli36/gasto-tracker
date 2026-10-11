// Un gasto en cuotas se guarda como N filas, una por mes: así cada mes
// solo cuenta su cuota y todas las métricas (que agrupan por date) siguen igual.

export const MAX_INSTALLMENTS = 36

// Suma meses a un 'YYYY-MM-DD' sin pasar por Date/timezone.
// Si el día no existe en ese mes (31 → febrero), usa el último día del mes.
export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

// Reparte el total en centavos; la última cuota absorbe el redondeo para que la suma dé exacto.
export function splitInstallments(total: number, count: number, firstDate: string) {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    amount: (i === count - 1 ? cents - base * (count - 1) : base) / 100,
    date: addMonths(firstDate, i),
  }))
}

export function installmentDescription(description: string | null, number: number, count: number) {
  return description ? `${description} · cuota ${number}/${count}` : `Cuota ${number}/${count}`
}
