// Browser-only: reads the text of a PO PDF. Uses the PDF's own text layer when it has one, and falls
// back to OCR (English model, bundled in public/ocr, so no CDN and it works offline) for scanned files.
// pdf.js and tesseract are imported on demand so they stay out of the main bundle.

export type PdfText = { text: string; ocr: boolean; pages: number }
type Progress = (msg: string) => void

// OCR is slow (~15 s a page) and the PO number is on page 1; later pages are mostly terms and conditions
const MAX_OCR_PAGES = 1
const hasText = (t: string, pages: number) => t.replace(/[^A-Za-z0-9฀-๿]/g, '').length >= 40 * Math.min(pages, 1)

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
}

export async function readPdfText(file: File, onProgress: Progress = () => {}): Promise<PdfText> {
  const pdf = await loadPdf(file)
  let text = ''
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    let lastY: number | null = null
    for (const it of content.items) {
      if (!('str' in it)) continue
      const y = it.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'
      else if (lastY !== null) text += ' '
      text += it.str
      lastY = y
    }
    text += '\n'
  }
  if (hasText(text, pdf.numPages)) return { text, ocr: false, pages: pdf.numPages }

  onProgress('ไฟล์เป็นภาพสแกน กำลังอ่านด้วย OCR…')
  const { createWorker } = await import('tesseract.js')
  const base = new URL('ocr/', document.baseURI).href
  const worker = await createWorker('eng', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base + 'tesseract-core-lstm.wasm.js',
    langPath: base,
    gzip: true,
    // the model is served from our own origin (and cached by the PWA); tesseract's own IndexedDB copy is redundant
    cacheMethod: 'none',
    logger: (m) => m.status === 'recognizing text' && onProgress(`OCR ${Math.round(m.progress * 100)}%`),
  })
  try {
    let out = ''
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_OCR_PAGES); n++) {
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale: 2.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvas, viewport }).promise
      out += (await worker.recognize(canvas)).data.text + '\n'
    }
    return { text: out, ocr: true, pages: pdf.numPages }
  } finally {
    await worker.terminate()
  }
}
