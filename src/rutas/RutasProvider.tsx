import { useEffect, useState, type ReactNode } from 'react'
import { obtenerRutasActivas, type Ruta } from '../api/rutas.ts'
import { useAuth } from '../auth/useAuth.ts'
import { RutasContext } from './RutasContext.ts'

const mensajeError = (err: unknown) =>
  `No se pudieron cargar las rutas: ${err instanceof Error ? err.message : 'error desconocido'}`

export function RutasProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Las rutas dependen de los roles del usuario: se vuelven a pedir al iniciar o cerrar sesion
  const idUsuario = usuario?.id ?? null
  useEffect(() => {
    let vigente = true
    obtenerRutasActivas()
      .then((nuevas) => {
        if (!vigente) return
        setRutas(nuevas)
        setError(null)
      })
      .catch((err) => { if (vigente) setError(mensajeError(err)) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [idUsuario])

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
