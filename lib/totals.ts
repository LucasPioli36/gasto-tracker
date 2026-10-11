import { getCategoryKind } from './categories'

export type Movement = { amount: number; is_income: boolean; category: string }

// Gasto del día a día: ni ingresos, ni ahorro, ni extraordinarios (viajes).
export function isDailyExpense(r: Movement) {
  return !r.is_income && getCategoryKind(r.category) === 'gasto'
}

// Única definición de la métrica del mes. Es un GROUP BY kind:
//   spent  = gastos del día a día (lo único que consume el límite)
//   saved  = movimientos a ahorro (no son gasto)
//   extra  = gastos extraordinarios (viajes), se muestran aparte
// disponible individual = salary + income − savings_goal − spent
// disponible pareja     = presupuesto + income − spent
export function movementTotals(rows: Movement[]) {
  let spent = 0
  let income = 0
  let saved = 0
  let extra = 0
  for (const r of rows) {
    if (r.is_income) {
      income += r.amount
      continue
    }
    const kind = getCategoryKind(r.category)
    if (kind === 'ahorro') saved += r.amount
    else if (kind === 'extraordinario') extra += r.amount
    else spent += r.amount
  }
  return { spent, income, saved, extra }
}

// GROUP BY created_by sobre los gastos del día a día de pareja: cuánto pagó cada uno.
export function contributionTotals(rows: (Movement & { created_by: string | null })[]) {
  const map = new Map<string | null, number>()
  for (const r of rows) {
    if (!isDailyExpense(r)) continue
    map.set(r.created_by, (map.get(r.created_by) ?? 0) + r.amount)
  }
  return map
}

// GROUP BY category sobre los gastos del día a día, ordenado de mayor a menor.
export function categoryTotals(rows: Movement[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!isDailyExpense(r)) continue
    map.set(r.category, (map.get(r.category) ?? 0) + r.amount)
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}
