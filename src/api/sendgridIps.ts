import { api } from './cliente.ts'
export interface IpSendgrid { id: number; ip: string; created_at?: number }
export interface ListaIps { ips: IpSendgrid[] }
export const listarIpsSendgrid = (signal?: AbortSignal) => api<ListaIps>('/sendgrid-ips', { signal })
export const agregarIpSendgrid = (ip: string) =>
  api<ListaIps>('/sendgrid-ips', { method: 'POST', body: JSON.stringify({ ip }), notificar: false })
export const obtenerIpSendgrid = (id: number) => api<{ ip: IpSendgrid }>(`/sendgrid-ips/${id}`)
export const actualizarIpSendgrid = (id: number, ip: string) =>
 api<ListaIps>(`/sendgrid-ips/${id}`, { method: 'PUT', body: JSON.stringify({ ip }), notificar: false })
export const eliminarIpSendgrid = (id: number) =>
 api<void>(`/sendgrid-ips/${id}`, { method: 'DELETE', notificar: false })
