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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
