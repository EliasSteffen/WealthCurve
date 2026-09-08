import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Handschrift für den gezeichneten Stil - selbst gehostet, damit zur Laufzeit
// keine Netzwerkabhängigkeit entsteht.
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
