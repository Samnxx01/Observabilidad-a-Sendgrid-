import { api } from './cliente.ts'
export interface Servicio {
  id: string
  nombre: string
  estado: string
  detalle: string
  comprobadoEn?: string
  codigoHttp?: number
  latenciaMs?: number
  ultimaEjecucion?: string | null
  proximaEjecucion?: string | null
  conexiones?: { baseDatos: string; estado: string }[]
}
export interface EstadoServicios {
  actualizadoEn: string
  uptimeSegundos: number
  servicios: Servicio[]
}
export const obtenerEstadoServicios = (signal?: AbortSignal) => api<EstadoServicios>('/servicios', { signal })
