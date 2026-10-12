import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { unlockAudio } from './lib/sound'
import './styles.css'

unlockAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
