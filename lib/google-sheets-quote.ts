import 'server-only'

const DEFAULT_SPREADSHEET_ID = '19OVa5P7s88I32dTfDYGVjnhRQyZlBF63jWbuiSyFldE'

export type CspxQuote = { price: number; tradeAt: string; tradingDate: string }

function parsePrice(value: string) {
  const cleaned = value.trim().replace(/[^0-9,.-]/g, '')
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned
  const price = Number(normalized)
  if (!Number.isFinite(price) || price <= 0) throw new Error('La celda A1 no contiene un precio válido.')
  return price
}

function parseSheetTradeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) throw new Error('La celda B1 no contiene una fecha de cotización reconocible.')
  const [, dayText, monthText, yearText, hourText, minuteText, secondText = '0'] = match
  const [day, month, year, hour, minute, second] = [dayText, monthText, yearText, hourText, minuteText, secondText].map(Number)
  const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (timestamp.getUTCFullYear() !== year || timestamp.getUTCMonth() !== month - 1 || timestamp.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new Error('La celda B1 no contiene una fecha de cotización válida.')
  }
  const tradingDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { tradeAt: value.trim(), tradingDate }
}

function todayInMontevideo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function fetchCspxQuote(): Promise<CspxQuote> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  if (!apiKey) throw new Error('Falta configurar GOOGLE_SHEETS_API_KEY.')

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID
  const range = encodeURIComponent("'Hoja 1'!A1:B1")
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`)
  url.searchParams.set('valueRenderOption', 'FORMATTED_VALUE')
  url.searchParams.set('key', apiKey)
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      throw new Error('Google Sheets no permite leer A1:B1. Revisá el acceso de solo lectura y la clave de API.')
    }
    throw new Error(`Google Sheets respondió ${response.status}.`)
  }

  const payload = await response.json() as { values?: string[][] }
  const [priceText, tradeTimeText] = payload.values?.[0] ?? []
  if (!priceText || !tradeTimeText) throw new Error('La hoja no devolvió las celdas A1 y B1.')
  const timestamp = parseSheetTradeTime(tradeTimeText)
  const today = todayInMontevideo()
  const ageInDays = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${timestamp.tradingDate}T00:00:00Z`)) / 86_400_000
  if (ageInDays < 0) throw new Error('La fecha de cotización de B1 está en el futuro.')
  if (ageInDays > 5) throw new Error('La última cotización de B1 tiene más de cinco días.')

  return { price: parsePrice(priceText), ...timestamp }
}
