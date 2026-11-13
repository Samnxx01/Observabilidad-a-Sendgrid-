import { api } from './cliente.ts'
import type { Rol } from './roles.ts'

export interface UsuarioAdministrable {
  id: string
  correo: string
  roles: string[]
  verificado: boolean
  fechaCreacion?: string
}
export const obtenerUsuarios = async (signal?: AbortSignal) =>
  (await api<{ usuarios: UsuarioAdministrable[] }>('/roles/usuarios', { signal })).usuarios
export const obtenerRolesParaUsuarios = async (signal?: AbortSignal) =>
  (await api<{ roles: Rol[] }>('/roles/usuarios/catalogo', { signal })).roles
export const guardarUsuario = async (usuario: UsuarioAdministrable, contrasena?: string, rolesContrasena: string[] = []) =>
  (await api<{ usuario: UsuarioAdministrable }>(`/roles/usuarios/${encodeURIComponent(usuario.id)}`, {
    method: 'PUT', body: JSON.stringify({ roles: usuario.roles, verificado: usuario.verificado, ...(contrasena === undefined ? {} : { contrasena, rolesContrasena }) }),
  })).usuario

export const obtenerVigenciaToken = (signal?: AbortSignal) =>
  api<{ vigencia: string }>('/roles/usuarios/vigencia-token', { signal })
export const guardarVigenciaToken = (vigencia: string) =>
  api<{ vigencia: string }>('/roles/usuarios/vigencia-token', { method: 'PUT', body: JSON.stringify({ vigencia }) })
