export type Movement = { amount: number; is_income: boolean }

// Única definición de la métrica del mes: separa gastos de ingresos.
// disponible individual = salary + income − savings_goal − spent
// disponible pareja     = depositado + income − spent
export function movementTotals(rows: Movement[]) {
  let spent = 0
  let income = 0
  for (const r of rows) {
    if (r.is_income) income += r.amount
    else spent += r.amount
  }
  return { spent, income }
}

export type CategoryMovement = Movement & { category: string }

// GROUP BY category sobre los gastos (excluye ingresos), ordenado de mayor a menor.
export function categoryTotals(rows: CategoryMovement[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.is_income) continue
    map.set(r.category, (map.get(r.category) ?? 0) + r.amount)
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}
