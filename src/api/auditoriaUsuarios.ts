import { api } from './cliente.ts'
export interface RegistroAuditoria {
  solicitudId: string
  formulario: string
  accion: string
  metodo: string
  endpoint: string
  correo?: string
  autenticado: boolean
  fecha: string
  estado: string
  cambioDatos?: string
  codigoHttp?: number
  duracionMs?: number
}
export interface HistorialAuditoria {
  formulario: string
  pagina: number
  limite: number
  total: number
  registros: RegistroAuditoria[]
}
export const obtenerComponentesAuditoria = async (signal?: AbortSignal) =>
  (await api<{ componentes: string[] }>('/auditoria-usuarios', { signal })).componentes
export const obtenerAuditoriaComponente = (componente: string, pagina: number, signal?: AbortSignal) =>
  api<HistorialAuditoria>(`/auditoria-usuarios/${encodeURIComponent(componente)}?pagina=${pagina}&limite=20`, { signal })

// Retencion de la auditoria por componente y accion ('*' = todas las acciones del componente)
export interface ReglaRetencion {
  formulario: string
  accion: string
  dias: number
  activo: boolean
  // Registros que borraria hoy (solo en la respuesta)
  eliminables?: number
}
export interface EstadoRetencion {
  reglas: ReglaRetencion[]
  componentes: string[]
  acciones: string[]
  enCurso: boolean
  ultimaEjecucion: string | null
  proximaEjecucion: string | null
  resultado: { eliminados?: number; error?: string } | null
}
export const obtenerRetencion = (signal?: AbortSignal) =>
  api<EstadoRetencion>('/auditoria-usuarios/retencion', { signal })
export const guardarRetencion = (reglas: ReglaRetencion[]) =>
  api<EstadoRetencion>('/auditoria-usuarios/retencion', {
    method: 'PUT',
    body: JSON.stringify({ reglas: reglas.map(({ formulario, accion, dias, activo }) => ({ formulario, accion, dias, activo })) }),
  })
export const ejecutarRetencion = () =>
  api<EstadoRetencion>('/auditoria-usuarios/retencion/ejecutar', { method: 'POST' })
