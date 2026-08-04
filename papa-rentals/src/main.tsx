import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
/* The filmic grade: anamorphic fringing and a directional trail on the type,
   35mm grain over the frame, warm stock, soft corners. It only ever paints on
   top of the design system, so removing this one line takes the whole look off
   without touching anything else. */
import './styles.vintage.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// installable + offline-capable (production builds only, so dev stays cache-free)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
