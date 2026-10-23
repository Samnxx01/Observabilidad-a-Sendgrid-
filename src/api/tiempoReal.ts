type Oyente = (datos: unknown) => void
const oyentes = new Map<string, Set<Oyente>>()
const peticiones = new Map<string, RequestInit>()
export function recordarConsulta(ruta: string, opciones: RequestInit) {
  const metodo = (opciones.method ?? 'GET').toUpperCase()
  if (metodo === 'GET' || (metodo === 'POST' && ['/sendgrid/facturas', '/sendgrid/logs', '/sendgrid/auditoria', '/notificaciones/facturas'].includes(ruta))) {
    const { signal: _signal, ...resto } = opciones
    void _signal
    peticiones.set(ruta, resto)
  }
}
export function suscribirRespuesta(ruta: string, oyente: Oyente) {
  if (!oyentes.has(ruta)) oyentes.set(ruta, new Set())
  oyentes.get(ruta)!.add(oyente)
  return () => { oyentes.get(ruta)?.delete(oyente); if (!oyentes.get(ruta)?.size) { oyentes.delete(ruta); peticiones.delete(ruta) } }
}
let actualizando = false
let pendiente = false
export async function refrescarConsultas(solicitar: (ruta: string, opciones: RequestInit) => Promise<unknown>) {
  if (actualizando) { pendiente = true; return }
  actualizando = true
  try {
    do {
      pendiente = false
      await Promise.all([...oyentes.keys()].map(async ruta => {
        const opciones = peticiones.get(ruta)
        if (!opciones) return
        try { const datos = await solicitar(ruta, opciones); oyentes.get(ruta)?.forEach(oyente => oyente(datos)) } catch { /* El formulario conserva la ultima lectura; la API mantiene los permisos. */ }
      }))
    } while (pendiente)
  } finally { actualizando = false }
}
export function limpiarConsultas() { peticiones.clear() }
