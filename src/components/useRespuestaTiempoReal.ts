import { useEffect, useEffectEvent } from 'react'
import { suscribirRespuesta } from '../api/tiempoReal.ts'
export function useRespuestaTiempoReal<T>(ruta: string, actualizar: (datos: T) => void) {
  const recibir = useEffectEvent((datos: unknown) => actualizar(datos as T))
  useEffect(() => suscribirRespuesta(ruta, datos => recibir(datos)), [ruta])
}
