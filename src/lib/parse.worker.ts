import * as XLSX from 'xlsx'
import type { ParsedSheet } from '../types'

type Scope = {
  postMessage(m: unknown): void
  onmessage: ((e: MessageEvent<{ buf: ArrayBuffer; name: string }>) => void) | null
}
const ctx = self as unknown as Scope

// SheetJS reads CSV bytes as Latin-1, which garbles Thai. Decode as UTF-8 ourselves,
// falling back to the legacy Thai code page (Windows-874) used by older Excel exports.
function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-874').decode(buf)
  }
}

// Parsing 4k+ rows of xlsx blocks for a moment; do it off the main thread.
ctx.onmessage = (e) => {
  try {
    const wb = /\.(csv|txt)$/i.test(e.data.name)
      ? XLSX.read(decodeText(e.data.buf), { type: 'string' })
      : XLSX.read(e.data.buf, { type: 'array' })
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
