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

export interface Integraciones {
  sendgridConfigurado: boolean
  newrelicConfigurado: boolean
  keyId: string
  account: string
  region: 'US' | 'EU'
  enabled: boolean
}
export const obtenerIntegraciones = () => api<Integraciones>('/servicios/integraciones')
export const guardarIntegraciones = (datos: Omit<Integraciones, 'sendgridConfigurado' | 'newrelicConfigurado'> & { sendgridApiKey: string; newrelicApiKey: string }) =>
  api<Integraciones>('/servicios/integraciones', { method: 'PUT', body: JSON.stringify(datos) })
