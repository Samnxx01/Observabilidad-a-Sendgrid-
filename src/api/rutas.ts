import { api } from './cliente.ts'

export interface AccessType {
  id: string
  codigo: string
  nombre: string
  descripcion?: string | null
}

export interface Ruta {
  id: string
  path: string
  componente: string
  titulo: string | null
  orden: number
  activo: boolean
  accessType: Pick<AccessType, 'id' | 'codigo' | 'nombre'> | null
}

// El orden no se envia: el backend lo asigna (las rutas nuevas van al final)
export interface DatosRuta {
  path: string
  componente: string
  titulo: string
  accessType: string
  activo: boolean
}

// Rutas activas (publico: se necesitan antes de iniciar sesion)
export const obtenerRutasActivas = () =>
  api<{ rutas: Ruta[] }>('/rutas').then((r) => r.rutas)

// Todas las rutas, incluidas las inactivas (requiere sesion)
export const obtenerTodasLasRutas = () =>
  api<{ rutas: Ruta[] }>('/rutas/todas').then((r) => r.rutas)

export const obtenerAccessTypes = () =>
  api<{ accessTypes: AccessType[] }>('/catalogos/accesstype').then((r) => r.accessTypes)

export const crearRuta = (datos: DatosRuta) =>
  api<{ ruta: Ruta }>('/rutas', { method: 'POST', body: JSON.stringify(datos) }).then((r) => r.ruta)

export const actualizarRuta = (id: string, datos: DatosRuta) =>
  api<{ ruta: Ruta }>(`/rutas/${id}`, { method: 'PUT', body: JSON.stringify(datos) }).then((r) => r.ruta)

export const eliminarRuta = (id: string) =>
  api<void>(`/rutas/${id}`, { method: 'DELETE' })

// Intercambia la ruta con la anterior o la siguiente; devuelve todas las rutas ya reordenadas
export const moverRuta = (id: string, direccion: 'arriba' | 'abajo') =>
  api<{ rutas: Ruta[] }>(`/rutas/${id}/orden`, { method: 'PATCH', body: JSON.stringify({ direccion }) })
    .then((r) => r.rutas)
