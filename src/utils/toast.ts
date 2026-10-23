export type TipoToast = 'exito' | 'error' | 'aviso' | 'info'
export interface AvisoToast { id: number; tipo: TipoToast; mensaje: string }
const oyentes = new Set<(aviso: AvisoToast) => void>()
let consecutivo = 0
export function notificar(mensaje: string, tipo: TipoToast = 'exito') {
  for (const escuchar of oyentes) escuchar({ id: ++consecutivo, tipo, mensaje })
}
export function escucharToast(escuchar: (aviso: AvisoToast) => void) {
  oyentes.add(escuchar)
  return () => { oyentes.delete(escuchar) }
}
export function mensajeAccion(ruta: string, metodo: string) {
  if (ruta === '/auth/login') return 'Sesión iniciada correctamente'
  if (ruta === '/auth/logout') return 'Sesión cerrada'
  if (ruta === '/auth/registro') return 'Usuario registrado correctamente'
  if (ruta.includes('/exportar')) return 'Datos preparados para exportar'
  if (ruta.includes('/sincronizar')) return 'Sincronización completada'
  if (ruta.endsWith('/ejecutar') || ruta.endsWith('/enviar')) return 'Acción ejecutada correctamente'
  if (metodo === 'DELETE') return 'Registro eliminado correctamente'
  if (metodo === 'PUT' || metodo === 'PATCH') return 'Cambios guardados correctamente'
  if (metodo === 'GET' || ruta === '/sendgrid/auditoria' || /\/(facturas|logs)$/.test(ruta)) return 'Consulta completada'
  return 'Registro guardado correctamente'
}
