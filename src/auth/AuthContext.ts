import { createContext } from 'react'
import type { Usuario } from '../api/cliente.ts'

export interface ValorAuth {
  usuario: Usuario | null
  // true mientras se pregunta al backend si hay una sesion (cookie) activa
  verificando: boolean
  // Mensaje para la pantalla de login, ej. cuando la sesion vencio
  aviso: string | null
  iniciarSesion: (correo: string, contrasena: string) => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<ValorAuth | null>(null)
