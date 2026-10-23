import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { RutasProvider } from './rutas/RutasProvider.tsx'

// Logo (barra, login y favicon) y pagina despues del login; no bloquea el arranque

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RutasProvider>
          <App />
        </RutasProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
