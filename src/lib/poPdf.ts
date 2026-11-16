// Browser-only: reads the text of a PO PDF. Uses the PDF's own text layer when it has one, and falls
// back to OCR (English model, bundled in public/ocr, so no CDN and it works offline) for scanned files.
// pdf.js and tesseract are imported on demand so they stay out of the main bundle.

export type PdfText = { text: string; ocr: boolean; pages: number }
/** `fraction` is 0..1 progress through this one file, when known */
type Progress = (msg: string, fraction?: number) => void

// OCR is slow (several seconds a page) and the PO number is on page 1; later pages are mostly terms and conditions
const MAX_OCR_PAGES = 1
/** page render scale for OCR; 2.5 is ~190 dpi, enough for small print without making the image huge */
const OCR_SCALE = 2.5
const IDLE_MS = 2 * 60_000
const MAX_TEXT_PAGES = 10
const hasText = (t: string) => t.replace(/[^A-Za-z0-9\u0E00-\u0E7F]/g, '').length >= 40

/** a stage that never answers must end in a message, not a spinner (an old browser can kill pdf.js's worker silently) */
function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>
  return Promise.race([
    p,
    new Promise<never>((_, rej) => {
      t = setTimeout(() => rej(new Error(`${what}ไม่สำเร็จภายใน ${ms / 1000} วินาที (เบราว์เซอร์อาจเก่าเกินไป ลองอัปเดต Chrome/Edge)`)), ms)
    }),
  ]).finally(() => clearTimeout(t))
}

async function loadPdf(file: File) {
  // the legacy build is transpiled for older browsers (company-managed Chrome/Edge often lag behind)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  // No wasmUrl / iccUrl / standardFontDataUrl: v2.1.0 passed bundled copies and a user's Windows browser
  // hung on a PO; pdf.js's own fallbacks read the sample files fine (scan ~6 s, text ~0.2 s), so fewer moving parts.
  return within(
    pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise,
    30_000,
    'เปิดไฟล์ PDF ',
  )
}

/** text of one page; items on the same baseline are joined with a space, a new baseline starts a new line */
async function pageText(pdf: Awaited<ReturnType<typeof loadPdf>>, n: number): Promise<string> {
  const content = await within((async () => (await pdf.getPage(n)).getTextContent())(), 20_000, 'อ่านข้อความจาก PDF ')
  let text = ''
  let lastY: number | null = null
  for (const it of content.items) {
    if (!('str' in it)) continue
    const y = it.transform[5]
    if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'
    else if (lastY !== null) text += ' '
    text += it.str
    lastY = y
  }
  return text + '\n'
}

export async function readPdfText(file: File, onProgress: Progress = () => {}): Promise<PdfText> {
  onProgress('กำลังเปิดไฟล์…', 0.05)
  const pdf = await loadPdf(file)
  // Page 1 decides: the PO number is there. A scan has no text on it, so go straight to OCR without
  // touching the other pages; a text PDF gets its remaining pages read too (cheap, and totals or
  // delivery dates are often on a later page).
  let text = await pageText(pdf, 1)
  if (hasText(text)) {
    for (let n = 2; n <= Math.min(pdf.numPages, MAX_TEXT_PAGES); n++) text += await pageText(pdf, n)
    return { text, ocr: false, pages: pdf.numPages }
  }

  onProgress('ไฟล์เป็นภาพสแกน กำลังอ่านด้วย OCR…', 0.15)
  // engine first, then the page: this is the order that was tested; starting both at once stalled pdf.js's render in the dev preview
  const worker = await within(getWorker(), 60_000, 'เริ่มระบบ OCR ')
  onProgress('เตรียมหน้า PDF…', 0.3)
  try {
    let out = ''
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_OCR_PAGES); n++) {
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale: OCR_SCALE })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      // never leave the UI waiting silently if a page cannot be drawn
      await within(page.render({ canvas, viewport }).promise, 30_000, 'วาดหน้า PDF ')
      onProgress('กำลังอ่านตัวอักษร…', 0.4)
      onWorkerProgress = onProgress
      out += (await worker.recognize(canvas)).data.text + '\n'
    }
    return { text: out, ocr: true, pages: pdf.numPages }
  } finally {
    onWorkerProgress = null
    scheduleRelease()
  }
}

// One OCR worker is shared by every file of an import (and the next few minutes): creating one loads
// ~9 MB (wasm core + model) and costs several seconds, so it is only created on first use and torn down
// after it has been idle for a while to give the memory back.
type OcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>
let shared: Promise<OcrWorker> | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined
let onWorkerProgress: Progress | null = null

function getWorker(): Promise<OcrWorker> {
  clearTimeout(idleTimer)
  shared ??= import('tesseract.js').then(({ createWorker }) => {
    const base = new URL('ocr/', document.baseURI).href
    return createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + 'tesseract-core-lstm.wasm.js',
      langPath: base,
      gzip: true,
      // the model is served from our own origin (and cached by the PWA); tesseract's own IndexedDB copy is redundant
      cacheMethod: 'none',
      logger: (m) => m.status === 'recognizing text' && onWorkerProgress?.('กำลังอ่านตัวอักษร…', 0.4 + 0.6 * m.progress),
    })
  })
  // a failed start must not be cached, or every later file would fail the same way
  shared.catch(() => { shared = null })
  return shared
}

function scheduleRelease() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    const w = shared
    shared = null
    void w?.then((x) => x.terminate()).catch(() => {})
  }, IDLE_MS)
}
