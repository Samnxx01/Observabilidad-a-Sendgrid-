import { createContext } from 'react'
import type { Ruta } from '../api/rutas.ts'

export interface ValorRutas {
  rutas: Ruta[]
  cargando: boolean
  error: string | null
  // Vuelve a pedir las rutas al backend (ej. despues de editarlas)
  recargar: () => Promise<void>
  // Path configurado para un componente, ej. pathDeComponente('Login') -> '/login'
  pathDeComponente: (componente: string) => string | null
}

export const RutasContext = createContext<ValorRutas | null>(null)
