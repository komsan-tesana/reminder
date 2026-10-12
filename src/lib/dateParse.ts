import type { EraMode } from '../types'

const MIN_YEAR = 1900
const MAX_YEAR = 2200
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

function iso(y: number, m: number, d: number): string | null {
  if (y < MIN_YEAR || y > MAX_YEAR) return null
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return t.toISOString().slice(0, 10)
}

function toCE(year: number, era: EraMode): number {
  if (era === 'BE') return year - 543
  if (era === 'auto' && year > 2400) return year - 543
  return year
}

function fromSerial(n: number): string | null {
  if (n < 1 || n > 100000) return null
  const t = new Date(EXCEL_EPOCH + Math.floor(n) * 86400000)
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/**
 * Parse a spreadsheet cell into an ISO Gregorian date (yyyy-mm-dd).
 * Accepts Excel serial numbers, Date objects, yyyy-mm-dd and dd/mm/yyyy text
 * (day first), with Buddhist or Christian year. Returns null if not a valid date.
 */
export function parseDate(value: unknown, era: EraMode = 'auto'): string | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    return iso(toCE(value.getFullYear(), era), value.getMonth() + 1, value.getDate())
  }
  if (typeof value === 'number') return fromSerial(value)

  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4,6}(\.\d+)?$/.test(s) && Number(s) > 9999) return fromSerial(Number(s))

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/)
  if (m) return iso(toCE(+m[1], era), +m[2], +m[3])

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T\s].*)?$/)
  if (m) {
    let y = +m[3]
    if (m[3].length === 2) y += 2000
    return iso(toCE(y, era), +m[2], +m[1])
  }
  return null
}

/** Guess the era of a sample of cells: BE if any year is > 2400. */
export function detectEra(values: unknown[]): 'BE' | 'CE' {
  for (const v of values) {
    if (typeof v === 'number') continue
    const m = String(v ?? '').match(/(\d{4})/)
    if (m && +m[1] > 2400) return 'BE'
  }
  return 'CE'
}
