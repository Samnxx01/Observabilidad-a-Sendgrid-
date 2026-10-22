import { useAuth } from './auth/useAuth.ts'
import RutasDinamicas from './rutas/RutasDinamicas.tsx'

function App() {
  const { verificando } = useAuth()

  if (verificando) {
    return <p className="cargando" role="status">Cargando…</p>
  }
  return <RutasDinamicas />
}

export default App
