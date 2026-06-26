import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Keep the installed PWA current. With registerType:'autoUpdate', a newly
// deployed version is applied + the page reloaded automatically. We add active
// polling so a deploy reaches the phone within ~a minute instead of waiting for
// iOS to decide to re-check — the cause of the "stuck on old version" problem.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    const check = () => { if (navigator.onLine) registration.update().catch(() => {}) }
    setInterval(check, 60 * 1000) // every minute while open
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})
void updateSW

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
