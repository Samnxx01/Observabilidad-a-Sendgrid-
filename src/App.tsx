import TiempoReal from './components/TiempoReal.tsx'
import ToastNotificaciones from './components/ToastNotificaciones.tsx'
import { useEffect, useState } from 'react'
import CargaInicial from './components/CargaInicial.tsx'
import { cargarSitio } from './sitio/sitio.ts'
import { cargarTema } from './sitio/tema.ts'
import ConfirmacionProvider from './components/ConfirmacionProvider.tsx'
import { useAuth } from './auth/useAuth.ts'
import RutasDinamicas from './rutas/RutasDinamicas.tsx'

function App() {
  const { verificando } = useAuth()
  const [listo, setListo] = useState(false)
  useEffect(() => {
    let vigente = true
    const minimo = new Promise(resolve => setTimeout(resolve, 900))
    void Promise.allSettled([cargarSitio(), cargarTema(), minimo]).then(() => { if (vigente) setListo(true) })
    return () => { vigente = false }
  }, [])

  if (verificando || !listo) {
    return <CargaInicial />
  }
  return <ConfirmacionProvider><ToastNotificaciones /><TiempoReal /><RutasDinamicas /></ConfirmacionProvider>
}

export default App
