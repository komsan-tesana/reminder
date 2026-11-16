// Copies the OCR engine (worker, wasm core, English model) from node_modules into public/ocr so the
// app never fetches them from a CDN and OCR works offline. public/ocr is git-ignored; it is
// regenerated on predev / prebuild and ends up in the committed docs/ build.
import { cpSync, mkdirSync } from 'node:fs'
const out = new URL('../public/ocr/', import.meta.url)
mkdirSync(out, { recursive: true })
const from = (p) => new URL(`../node_modules/${p}`, import.meta.url)
cpSync(from('tesseract.js/dist/worker.min.js'), new URL('worker.min.js', out))
cpSync(from('tesseract.js-core/tesseract-core-lstm.wasm.js'), new URL('tesseract-core-lstm.wasm.js', out))
cpSync(from('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), new URL('eng.traineddata.gz', out))
// pdf.js loads these on demand while drawing a page (colour profiles, wasm decoders, non-embedded fonts);
// without them rendering a scanned page can stall, and the default URLs do not exist on GitHub Pages
for (const dir of ['wasm', 'iccs', 'standard_fonts']) cpSync(from(`pdfjs-dist/${dir}`), new URL(`pdf/${dir}/`, out), { recursive: true })
console.log('OCR assets copied to public/ocr')
