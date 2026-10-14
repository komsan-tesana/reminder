import '@fontsource/ibm-plex-sans-thai/latin-400.css'
import '@fontsource/ibm-plex-sans-thai/latin-600.css'
import '@fontsource/ibm-plex-sans-thai/latin-700.css'
import '@fontsource/ibm-plex-sans-thai/thai-400.css'
import '@fontsource/ibm-plex-sans-thai/thai-600.css'
import '@fontsource/ibm-plex-sans-thai/thai-700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadSettings } from './lib/db'
import { applyTheme } from './lib/theme'
import { unlockAudio } from './lib/sound'
import './styles.css'

// set the theme before the first paint so a dark-mode user never sees a white flash
applyTheme(loadSettings().theme)
unlockAudio()

// registered in production builds only, so the dev server is never cached
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
