import { api } from './cliente.ts'

export interface Rol {
  codigo: string
  nombre: string
  acciones: string[]
}

export const obtenerRoles = async (signal?: AbortSignal) =>
  (await api<{ roles: Rol[] }>('/roles', { signal })).roles

export const obtenerAcciones = async (signal?: AbortSignal) =>
  (await api<{ acciones: string[] }>('/roles/acciones', { signal })).acciones

export const guardarRol = async (rol: Rol) =>
  (await api<{ rol: Rol }>(`/roles/${encodeURIComponent(rol.codigo)}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre: rol.nombre, acciones: rol.acciones }),
  })).rol
