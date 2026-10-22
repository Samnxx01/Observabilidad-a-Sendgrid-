import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.ts'
import { useRutas } from './useRutas.ts'

interface EstadoNavegacion {
  desde?: string
  correo?: string
}

// accessType PRIVADA: sin sesion redirige al login (y vuelve aqui despues de entrar)
export function RequiereSesion() {
  const { usuario } = useAuth()
  const { pathDeComponente } = useRutas()
  const location = useLocation()

  if (usuario) {
    return <Outlet />
  }

  const login = pathDeComponente('Login')
  if (!login) {
    return <p className="cargando">No hay una ruta configurada para el componente Login.</p>
  }
  return <Navigate to={login} replace state={{ desde: location.pathname } satisfies EstadoNavegacion} />
}

// accessType SOLO_INVITADO: con sesion redirige a donde iba el usuario o al inicio
export function SoloInvitado() {
  const { usuario } = useAuth()
  const estado = useLocation().state as EstadoNavegacion | null

  if (usuario) {
    return <Navigate to={estado?.desde ?? '/'} replace />
  }
  return <Outlet />
}
