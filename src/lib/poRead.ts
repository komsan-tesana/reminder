import type { Shipment } from '../types'

/** the key used to compare PO numbers: case, spaces and punctuation do not matter */
export const poKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** A plan's Customer reference can hold several POs ("A123, B456"); each token is a possible key. */
export function refTokens(ref: string): string[] {
  return ref
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter((t) => usableKey(poKey(t)))
}

/** too short or purely small numbers would match phone numbers and page counts */
function usableKey(k: string) {
  return k.length >= 5 || (k.length >= 4 && /[A-Z]/.test(k) && /\d/.test(k))
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Pattern-free detection: look for the Customer references that already exist in the plan inside the
 * file name and text. Whole-token hits are strong; a reference glued to other characters (e.g. a PO
 * number printed right against a date) is weak.
 */
export function findPlanRefs(fileName: string, text: string, planRefs: string[]): { strong: string[]; weak: string[] } {
  const tokens = new Map<string, string>() // key -> raw token
  for (const r of planRefs) for (const t of refTokens(r)) tokens.set(poKey(t), t)
  const hay = `${fileName}\n${text}`
  const blob = poKey(hay)
  const strong: string[] = []
  const weak: string[] = []
  for (const [key, raw] of tokens) {
    const re = new RegExp(`(?<![A-Za-z0-9])${esc(raw).replace(/[-/._ ]+/g, '[-/._ ]?')}(?![A-Za-z0-9])`, 'i')
    if (re.test(hay)) strong.push(raw)
    else if (key.length >= 6 && /\d/.test(key) && blob.includes(key)) weak.push(raw)
  }
  return { strong, weak }
}

// ---- guessing the PO number when the plan does not know it yet ----

const LABEL =
  /(?:purchase\s*order|p\.?\s?o\.?|order)\s*(?:no\.?|number|num\.?|#)\s*[:：.\-]?|เลขที่\s*(?:ใบสั่งซื้อ|po|p\/o)|ใบสั่งซื้อ\s*(?:เลขที่|no\.?)/i
const TOKEN = /[A-Za-z0-9][A-Za-z0-9\-/._]{2,}/g
const DATEISH = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/

/** strips a date printed straight after the number ("26400610/11/26" -> "264006") and trailing punctuation */
function cleanCandidate(t: string): string {
  let s = t.replace(/^[-/._]+|[-/._]+$/g, '')
  const glued = /^(.{4,}?)(\d{2}[/-]\d{2}[/-]\d{2,4})$/.exec(s)
  if (glued) s = glued[1]
  return s
}
const okCandidate = (s: string) => s.length >= (/^\d+$/.test(s) ? 5 : 4) && s.length <= 25 && /\d/.test(s) && !DATEISH.test(s) && !/^(NO|DATE|PAGE)$/i.test(s)

export function poCandidates(fileName: string, text: string): string[] {
  const score = new Map<string, number>()
  const display = new Map<string, string>()
  const add = (raw: string, pts: number) => {
    const c = cleanCandidate(raw)
    if (!okCandidate(c)) return
    const k = poKey(c)
    score.set(k, (score.get(k) ?? 0) + pts)
    if (!display.has(k)) display.set(k, c)
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  lines.forEach((l, i) => {
    const m = LABEL.exec(l)
    if (!m) return
    const rest = l.slice(m.index + m[0].length)
    const here = rest.match(TOKEN)?.[0]
    if (here && okCandidate(cleanCandidate(here))) return add(here, 4)
    // value on the following line(s)
    for (const nx of lines.slice(i + 1, i + 3)) {
      const t = nx.match(TOKEN)?.find((x) => okCandidate(cleanCandidate(x)))
      if (t) return add(t, 3)
    }
  })
  for (const m of text.matchAll(/\*([A-Z0-9\-]{4,})\*/g)) add(m[1], 2)
  for (const t of fileName.replace(/\.[a-z0-9]+$/i, '').split(/[\s_]+/)) add(t, 2)
  // a candidate seen several times in the document is likelier to be the PO number
  const hayKey = poKey(text)
  for (const [k] of score) {
    const n = hayKey.split(k).length - 1
    if (n >= 2) score.set(k, score.get(k)! + Math.min(n, 3))
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => display.get(k)!).slice(0, 6)
}

// ---- best-effort facts ----

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  else if (y > 2400) y -= 543
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** dates in the text: 16/11/2026, 10-12-26, 12-Nov-2026, 2026-11-16 (day first, like the plan import) */
export function findDates(text: string): string[] {
  const out = new Set<string>()
  const add = (d: string | null) => d && out.add(d)
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g)) add(iso(+m[3], +m[2], +m[1]))
  for (const m of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) add(iso(+m[1], +m[2], +m[3]))
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{4})(?!\d)/g)) {
    const mi = MONTHS.indexOf(m[2].toLowerCase())
    if (mi >= 0) add(iso(+m[3], mi + 1, +m[1]))
  }
  return [...out].sort()
}

/** the date printed next to a "PO date / Order date" label, if any */
export function findPoDate(text: string): string {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (/(?:purchase\s*order|p\.?o\.?|order)\s*date|op\s*date|วันที่(?:สั่งซื้อ|ออก)/i.test(lines[i])) {
      const d = findDates(lines.slice(i, i + 2).join(' '))
      if (d.length) return d[0]
    }
  }
  // no label found (or its date is glued to a number): the earliest date in the file is normally the issue date
  return findDates(text)[0] ?? ''
}

export function findTotal(text: string): { total: number | null; currency: string } {
  const lines = text.split(/\r?\n/)
  const rank = (l: string) =>
    /grand\s*total|total\s*(?:gross\s*)?amount|total\s*cost|รวมทั้งสิ้น|ยอดรวม/i.test(l) ? 2 : /total\s*order|net\s*amount/i.test(l) ? 1 : 0
  let best: { v: number; r: number; cur: string } | null = null
  lines.forEach((l, i) => {
    const r = rank(l)
    if (!r || /tax|vat|ภาษี/i.test(l)) return
    const nums = [...(l + ' ' + (lines[i + 1] ?? '')).matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d{2}/g)]
    if (!nums.length) return
    const v = Number(nums[0][0].replace(/,/g, ''))
    const cur = /\b(THB|USD|EUR|JPY|CNY)\b/i.exec(l)?.[1].toUpperCase() ?? ''
    if (!best || r > best.r) best = { v, r, cur }
  })
  const found = best as { v: number; r: number; cur: string } | null
  return { total: found?.v ?? null, currency: found?.cur ?? (/\bTHB\b/.test(text) ? 'THB' : '') }
}

/** the company that issued the PO: the first company-looking line that is not us */
export function findIssuer(text: string, ownNames: RegExp = /buranapa/i): string {
  const l = text.split(/\r?\n/).map((x) => x.trim()).find((x) => /\bco\.?,?\s*ltd|company|limited|บริษัท|จำกัด/i.test(x) && !ownNames.test(x) && x.length < 80)
  // OCR can join the neighbouring column onto the same line
  return (l ?? '').replace(/^[A-Za-z ]{2,15}:\s*/, '').replace(/\s+(?:PURCHASE\s*ORDER|P\.?O\.?\s*NO).*$/i, '').trim()
}

export type PoFacts = Pick<import('../types').PoRecord, 'poNo' | 'candidates' | 'issuer' | 'poDate' | 'dates' | 'total' | 'currency'>

/** Everything auto-detected from one document; `poNo` is the best guess, to be confirmed by the user. */
export function readPo(fileName: string, text: string, planRefs: string[]): PoFacts & { planHit: boolean } {
  const hit = findPlanRefs(fileName, text, planRefs)
  const guessed = poCandidates(fileName, text)
  const candidates = [...new Set([...hit.strong, ...hit.weak, ...guessed])].slice(0, 8)
  const planHit = hit.strong.length > 0 || hit.weak.length > 0
  const poNo = hit.strong[0] ?? hit.weak[0] ?? guessed[0] ?? ''
  const { total, currency } = findTotal(text)
  return { poNo, candidates, planHit, issuer: findIssuer(text), poDate: findPoDate(text), dates: findDates(text), total, currency }
}

export const planRefsOf = (rows: Shipment[]) => [...new Set(rows.map((r) => r.customerRef).filter(Boolean))]
