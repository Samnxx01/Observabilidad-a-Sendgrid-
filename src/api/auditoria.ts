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
  // Correo completo (igual) o parte del correo (contiene)
  destinatarios: string[]
  estados: string[]
  pendientes: boolean
  desde?: string
  hasta?: string
}

export interface RespuestaRechazos {
  empresas: { nit: string; nombre: string; baseDatos: string }[]
  // Por estado (sin el filtro de estado) y 'pendientes' (deferred sin resolver)
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

export interface ProgramacionWatcher {
  activo: boolean
  cadaMinutos: number
}

export interface EstadoWatcher {
  programacion: ProgramacionWatcher
  enCurso: boolean
  ultimaEjecucion: string | null
  duracionMs: number | null
  proximaEjecucion: string | null
  resultado: {
    error?: string
    bases?: number
    basesConError?: { baseDatos: string; error: string }[]
    insertados?: number
    duplicadosOmitidos?: number
    actualizados?: number
    deferredResueltos?: number
    newRelic?: { enviados: number; omitidos: number; pendientes: number | null; error?: string }
  } | null
  newRelic: {
    configurado: boolean
    problema: string | null
    regla: string
    total: number
    enviados: number
    omitidos: number
    pendientes: number
    ultimoEnvio: string | null
  }
}

export const obtenerWatcher = () => api<EstadoWatcher>('/sendgrid/auditoria/watcher')

export const guardarWatcher = (programacion: ProgramacionWatcher) =>
  api<EstadoWatcher>('/sendgrid/auditoria/watcher', { method: 'PUT', body: JSON.stringify(programacion) })

export const ejecutarWatcher = () =>
  api<EstadoWatcher>('/sendgrid/auditoria/watcher/ejecutar', { method: 'POST' })

export interface ProgramacionLimpieza {
  activo: boolean
  diasRetencion: number
  // Frecuencia: cada <cada> horas, o cada <cada> dias a la <hora> (Colombia)
  unidad: 'horas' | 'dias'
  cada: number
  hora: number
}

export interface EstadoLimpieza {
  programacion: ProgramacionLimpieza
  // Texto de la frecuencia guardada, ej. 'cada 7 días a las 02:00'
  frecuencia: string
  enCurso: boolean
  ultimaEjecucion: string | null
  proximaEjecucion: string | null
  resultado: { eliminados?: number; diasRetencion?: number; error?: string } | null
  diasRetencion: number
  fechaLimite: string
  eliminables: number
  conservaPendientesNewRelic: boolean
}

// Con diasRetencion devuelve la vista previa (cuantos se borrarian) sin guardar nada
export const obtenerLimpieza = (diasRetencion?: number) =>
  api<EstadoLimpieza>(`/sendgrid/auditoria/limpieza${diasRetencion ? `?diasRetencion=${diasRetencion}` : ''}`)

export const guardarLimpieza = (programacion: ProgramacionLimpieza) =>
  api<EstadoLimpieza>('/sendgrid/auditoria/limpieza', { method: 'PUT', body: JSON.stringify(programacion) })

export const ejecutarLimpieza = () =>
  api<EstadoLimpieza>('/sendgrid/auditoria/limpieza/ejecutar', { method: 'POST' })

// Rechazos repetidos ya guardados (mismo NIT, factura, destinatario y estado)
export const contarDuplicados = () =>
  api<{ grupos: number; duplicados: number }>('/sendgrid/auditoria/duplicados')

export const eliminarDuplicados = () =>
  api<{ grupos: number; eliminados: number }>('/sendgrid/auditoria/duplicados/eliminar', { method: 'POST' })

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
