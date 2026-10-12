import * as XLSX from 'xlsx'
import type { ParsedSheet } from '../types'

type Scope = {
  postMessage(m: unknown): void
  onmessage: ((e: MessageEvent<ArrayBuffer>) => void) | null
}
const ctx = self as unknown as Scope

// Parsing 4k+ rows of xlsx blocks for a moment; do it off the main thread.
ctx.onmessage = (e) => {
  try {
    const wb = XLSX.read(e.data, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
    const [head = [], ...rows] = all
    const result: ParsedSheet = {
      sheetName,
      headers: head.map((h) => String(h ?? '').trim()),
      rows,
    }
    ctx.postMessage({ ok: true, result })
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
