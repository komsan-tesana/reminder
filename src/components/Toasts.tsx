import { Toaster } from 'sonner'

/** Notices appear at the top and close themselves (sonner). Colours follow the app theme variables in styles.css. */
export default function Toasts() {
  return <Toaster position="top-right" duration={8000} closeButton offset="max(12px, env(safe-area-inset-top))" mobileOffset="max(12px, env(safe-area-inset-top))" />
}
