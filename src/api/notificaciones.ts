import { api } from './cliente.ts'

export interface EmpresaNotificaciones {
  nit: string
  nombre: string
  baseDatos: string
}

// Fila de Billing.ElectronicDocumentNotification con su factura
export interface Notificacion {
  nit: string
  empresa: string
  factura: string
  id: number
  documentoElectronicoId: number
  correo: string
  enviado: boolean
  fechaCreacion: string | null
  fechaEnvio: string | null
}

export interface RespuestaNotificaciones {
  orden: 'ASC' | 'DESC'
  desde: string
  hasta: string
  empresas: EmpresaNotificaciones[]
  facturas: string[]
  notificaciones: Notificacion[]
  // Bases donde fallo el procedimiento (ej. aun no se creo dbo.spConsultarNotificacionesFactura)
  errores: { nit: string; baseDatos: string; error: string }[]
  // Maximo de notificaciones por base y NIT de las bases que lo alcanzaron (puede haber mas)
  maxPorBase: number
  truncadas: string[]
}

export interface FiltrosNotificaciones {
  orden: 'ASC' | 'DESC'
  desde: string
  hasta: string
  nits: string[]
  // Vacio = cualquier factura (entonces el estado es obligatorio)
  facturas: string[]
  // null = todas, 0 = aun no enviadas, 1 = enviadas
  status: 0 | 1 | null
}

export const obtenerEmpresasNotificaciones = () =>
  api<{ empresas: EmpresaNotificaciones[] }>('/notificaciones/empresas').then((r) => r.empresas)

export const consultarNotificaciones = (filtros: FiltrosNotificaciones) =>
  api<RespuestaNotificaciones>('/notificaciones/facturas', {
    method: 'POST',
    body: JSON.stringify(filtros),
  })
