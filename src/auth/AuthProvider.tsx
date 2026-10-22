import { useEffect, useState, type ReactNode } from 'react'
import { api, alExpirarSesion, type Usuario } from '../api/cliente.ts'
import { AuthContext } from './AuthContext.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [verificando, setVerificando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    alExpirarSesion(() => {
      setUsuario(null)
      setAviso('Tu sesión venció. Inicia sesión de nuevo.')
    })

    // Si ya hay cookie de sesion valida (ej. al recargar), recupera el usuario
    api<{ usuario: Usuario }>('/auth/sesion')
      .then(({ usuario }) => setUsuario(usuario))
      .catch(() => setUsuario(null))
      .finally(() => setVerificando(false))

    return () => alExpirarSesion(null)
  }, [])

  const iniciarSesion = async (correo: string, contrasena: string) => {
    const { usuario } = await api<{ usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo, contrasena }),
    })
    setAviso(null)
    setUsuario(usuario)
  }

  const cerrarSesion = async () => {
    try {
      await api<void>('/auth/logout', { method: 'POST' })
    } finally {
      setAviso(null)
      setUsuario(null)
    }
  }

  return (
    <AuthContext value={{ usuario, verificando, aviso, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext>
  )
}
