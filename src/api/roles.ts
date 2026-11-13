import { api } from './cliente.ts'

export interface Rol {
  id: string
  codigo: string
  nombre: string
  acciones: string[]
}

export const obtenerRoles = async (signal?: AbortSignal) =>
  (await api<{ roles: Rol[] }>('/roles', { signal })).roles

export const obtenerAcciones = async (signal?: AbortSignal) =>
  (await api<{ acciones: string[] }>('/roles/acciones', { signal })).acciones

export const guardarRol = async (rol: Omit<Rol, 'id'> & { id?: string }) =>
  (await api<{ rol: Rol }>(rol.id ? `/roles/${encodeURIComponent(rol.id)}` : '/roles', {
    method: rol.id ? 'PUT' : 'POST',
    body: JSON.stringify({ codigo: rol.codigo, nombre: rol.nombre, acciones: rol.acciones }),
  })).rol
