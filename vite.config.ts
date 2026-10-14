import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// base './' keeps asset URLs relative so the build works under any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves the main branch's /docs folder
  build: { outDir: 'docs', emptyOutDir: true, chunkSizeWarningLimit: 700 },
  worker: { format: 'es' },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
})
