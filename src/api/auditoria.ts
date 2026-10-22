import { api } from './cliente.ts'

export interface BaseAuditoria {
  id: string
  baseDatos: string
  nit: string
  nombre: string | null
  fechaInicial: string
  activo: boolean
  ultimaSincronizacion: string | null
  ultimoError: string | null
}

export interface DatosBase {
  baseDatos: string
  fechaInicial: string
  activo: boolean
}

export interface Rechazo {
  id: string
  baseDatos: string
  nit: string
  razonSocial: string | null
  factura: string | null
  toEmail: string
  estado: string
  tipoFalla: string
  codigoSmtp: string | null
  reason: string | null
  fechaEnvio: string
  estadoResolucion: string | null
  fechaResolucion: string | null
}

// Listas vacias = sin filtro
export interface FiltrosRechazos {
  nits: string[]
  facturas: string[]
  estados: string[]
  pendientes: boolean
  desde?: string
  hasta?: string
}

export interface RespuestaRechazos {
  empresas: { nit: string; nombre: string; baseDatos: string }[]
  totales: Record<string, number>
  total: number
  pagina: number
  porPagina: number
  registros: Rechazo[]
}

export interface ResultadoSincronizacion {
  baseDatos: string
  insertados?: number
  actualizados?: number
  deferredResueltos?: number
  error?: string
}

export const consultarRechazos = (filtros: FiltrosRechazos, pagina: number, porPagina: number) =>
  api<RespuestaRechazos>('/sendgrid/auditoria', {
    method: 'POST',
    body: JSON.stringify({ ...filtros, pagina, porPagina }),
  })

export interface RechazoExportado {
  fechaEnvio: string
  baseDatos: string
  nit: string
  razonSocial: string | null
  factura: string | null
  tipoDocumento: string | null
  toEmail: string
  fromEmail: string | null
  estado: string
  tipoFalla: string
  esFinal: boolean
  codigoSmtp: string | null
  reason: string | null
  estadoResolucion: string | null
  fechaResolucion: string | null
  sgMessageId: string
}

// Todos los rechazos del filtro (sin paginacion, maximo 50000) para armar el Excel o el PDF
export const exportarRechazos = (filtros: FiltrosRechazos) =>
  api<{ registros: RechazoExportado[] }>('/sendgrid/auditoria/exportar', {
    method: 'POST',
    body: JSON.stringify(filtros),
  }).then((r) => r.registros)

// Sin NIT sincroniza todas las bases activas
export const sincronizarAuditoria = (nits: string[]) =>
  api<{ resultados: ResultadoSincronizacion[] }>('/sendgrid/auditoria/sincronizar', {
    method: 'POST',
    body: JSON.stringify({ nits }),
  }).then((r) => r.resultados)

export const obtenerBases = () =>
  api<{ bases: BaseAuditoria[] }>('/sendgrid/auditoria/bases').then((r) => r.bases)

export const crearBase = (datos: DatosBase) =>
  api<{ base: BaseAuditoria }>('/sendgrid/auditoria/bases', { method: 'POST', body: JSON.stringify(datos) })
    .then((r) => r.base)

export const actualizarBase = (id: string, datos: DatosBase) =>
  api<{ base: BaseAuditoria }>(`/sendgrid/auditoria/bases/${id}`, { method: 'PUT', body: JSON.stringify(datos) })
    .then((r) => r.base)

export const eliminarBase = (id: string) =>
  api<void>(`/sendgrid/auditoria/bases/${id}`, { method: 'DELETE' })
