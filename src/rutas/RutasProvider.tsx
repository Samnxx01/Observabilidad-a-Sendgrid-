import { useEffect, useState, type ReactNode } from 'react'
import { obtenerRutasActivas, type Ruta } from '../api/rutas.ts'
import { RutasContext } from './RutasContext.ts'

const mensajeError = (err: unknown) =>
  `No se pudieron cargar las rutas: ${err instanceof Error ? err.message : 'error desconocido'}`

export function RutasProvider({ children }: { children: ReactNode }) {
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerRutasActivas()
      .then(setRutas)
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false))
  }, [])

  const recargar = async () => {
    try {
      setRutas(await obtenerRutasActivas())
      setError(null)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  const pathDeComponente = (componente: string) =>
    rutas.find((r) => r.componente === componente)?.path ?? null

  return (
    <RutasContext value={{ rutas, cargando, error, recargar, pathDeComponente }}>
      {children}
    </RutasContext>
  )
}
