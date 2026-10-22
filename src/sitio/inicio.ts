import { useSyncExternalStore } from 'react'
import { api } from '../api/cliente.ts'

// Id de la ruta a la que se va despues de iniciar sesion (null = la primera privada por orden).
// Se guarda el id y no el path para que siga funcionando si se edita el path de la ruta.
let rutaInicio: string | null = null
const oyentes = new Set<() => void>()

export const publicarInicio = (id: string | null) => {
  rutaInicio = id
  oyentes.forEach((avisar) => avisar())
}

export const guardarInicio = async (id: string | null) => {
  const r = await api<{ rutaInicio: string | null }>('/configuracion/inicio', {
    method: 'PUT',
    body: JSON.stringify({ rutaInicio: id }),
  })
  publicarInicio(r.rutaInicio)
}

const suscribir = (avisar: () => void) => {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

export const useRutaInicio = () => useSyncExternalStore(suscribir, () => rutaInicio)
