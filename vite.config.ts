import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset URLs relative so the build works under any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
})
