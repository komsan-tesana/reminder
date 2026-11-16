import { useCallback, useEffect, useRef, useState } from 'react'
import type { Shipment } from '../types'
import { planRefsOf, readPo } from './poRead'

/** one PDF that has been read and waits for the user to confirm its PO number */
export type PoDraft = {
  key: string
  file: File
  text: string
  ocr: boolean
  poNo: string
  candidates: string[]
  planHit: boolean
  issuer: string
  poDate: string
  dates: string[]
  total: number | null
  currency: string
}

export type PoJob = {
  running: boolean
  /** what is happening now, e.g. "A.pdf (2/3): กำลังอ่านตัวอักษร…" */
  label: string
  /** 0..1 over all files of this run */
  fraction: number
  /** read but not yet confirmed; survives closing the dialog */
  drafts: PoDraft[] | null
  error: string
}

const IDLE: PoJob = { running: false, label: '', fraction: 0, drafts: null, error: '' }
export const poFileId = (f: File) => `${f.name.toLowerCase()}|${f.size}`

/**
 * Reads PO PDFs in the background. The state lives in App, not in the dialog, so closing the dialog
 * does not stop a run, and the finished drafts wait there until they are reviewed. Only one run at a
 * time; `start` ignores a second call while one is running.
 */
export function usePoImport(getShipments: () => Shipment[], onFinished: (read: number, failed: number) => void) {
  const [job, setJob] = useState<PoJob>(IDLE)
  const running = useRef(false)
  const finished = useRef(onFinished)
  finished.current = onFinished

  // closing the tab mid-read would lose the work
  useEffect(() => {
    if (!job.running) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [job.running])

  const start = useCallback(async (files: File[]): Promise<boolean> => {
    if (running.current || !files.length) return false
    running.current = true
    const refs = planRefsOf(getShipments())
    const out: PoDraft[] = []
    const errors: string[] = []
    const set = (patch: Partial<PoJob>) => setJob((j) => ({ ...j, ...patch }))
    set({ running: true, label: 'เริ่มอ่านไฟล์…', fraction: 0, error: '' })
    try {
      const { readPdfText } = await import('./poPdf')
      let lastPct = -1
      for (const [i, file] of files.entries()) {
        const tag = files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name
        try {
          const { text, ocr } = await readPdfText(file, (msg, frac) => {
            const fraction = (i + (frac ?? 0)) / files.length
            const pct = Math.round(fraction * 100)
            if (pct !== lastPct) {
              lastPct = pct
              set({ label: `${tag}: ${msg}`, fraction })
            }
          })
          out.push({ key: poFileId(file), file, text, ocr, ...readPo(file.name, text, refs) })
        } catch (e) {
          errors.push(`อ่าน ${file.name} ไม่ได้: ${e instanceof Error ? e.message : String(e)}`)
        }
        set({ fraction: (i + 1) / files.length })
      }
    } finally {
      running.current = false
      setJob((j) => {
        // keep drafts from an earlier run that were never confirmed; a re-read of the same file replaces its draft
        const keys = new Set(out.map((d) => d.key))
        const kept = (j.drafts ?? []).filter((d) => !keys.has(d.key))
        const drafts = [...kept, ...out]
        return { running: false, label: '', fraction: 1, drafts: drafts.length ? drafts : null, error: errors.join('\n') }
      })
      finished.current(out.length, errors.length)
    }
    return true
  }, [getShipments])

  const setDrafts = useCallback((drafts: PoDraft[] | null) => setJob((j) => ({ ...j, drafts })), [])
  const clearError = useCallback(() => setJob((j) => ({ ...j, error: '' })), [])
  return { job, start, setDrafts, clearError }
}
