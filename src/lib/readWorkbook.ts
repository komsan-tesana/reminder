import type { ParsedSheet } from '../types'

export async function readWorkbook(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer()
  const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: ParsedSheet; error?: string }>) => {
      worker.terminate()
      if (e.data.ok && e.data.result) resolve(e.data.result)
      else reject(new Error(e.data.error ?? 'อ่านไฟล์ไม่สำเร็จ'))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'อ่านไฟล์ไม่สำเร็จ'))
    }
    worker.postMessage(buf, [buf])
  })
}
