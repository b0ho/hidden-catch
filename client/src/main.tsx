import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Only register in production builds — in dev, the cache-first SW would keep serving
    // stale bundles across HMR reloads, making live code changes look broken or "stuck".
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // PWA offline support is best-effort; ignore registration failures.
      })
    })
  } else {
    // Self-heal browsers that registered the SW during an earlier dev session — otherwise
    // it keeps intercepting requests with stale cached responses even after this fix ships.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister())
    })
    caches?.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
  }
}
