import { recordarConsulta } from './tiempoReal.ts'
import { mensajeAccion, notificar } from '../utils/toast.ts'
export interface Usuario {
  id: string
  correo: string
  verificado?: boolean
  roles?: string[]
  acciones?: string[]
}

interface RespuestaError {
  mensaje?: string
  errores?: { msg: string; path?: string }[]
}

export class ErrorApi extends Error {
  status: number

  constructor(mensaje: string, status: number) {
    super(mensaje)
    this.status = status
  }
}

let alExpirar: (() => void) | null = null

// Se llama cuando el backend responde 401 en una ruta protegida (sesion vencida o invalida)
export const alExpirarSesion = (fn: (() => void) | null) => {
  alExpirar = fn
}

// Llama al backend (/api/...). La sesion viaja en la cookie HttpOnly 'sesion',
// que el navegador envia solo; el frontend nunca ve el token.
export async function api<T>(ruta: string, opciones: RequestInit & { notificar?: boolean } = {}): Promise<T> {
  const { notificar: avisar, ...peticion } = opciones
  const metodo = (peticion.method ?? 'GET').toUpperCase()
  const automatico = ['/auth/sesion', '/rutas', '/configuracion/sitio', '/catalogos/accesstype'].includes(ruta)
  const mostrar = avisar ?? (!automatico && (metodo !== 'GET' || /^\/(servicios|auditoria-usuarios)(\/|\?|$)/.test(ruta)))
  try {
    const respuesta = await llamar(ruta, peticion)
    if (respuesta.status === 204) {
      if (mostrar) notificar(mensajeAccion(ruta, metodo))
      return undefined as T
    }
    const datos = await respuesta.json() as T
    recordarConsulta(ruta, peticion)
    if (mostrar) {
      const parcial = datos as { errores?: unknown[]; resultados?: { error?: string; newRelic?: { error?: string } }[]; resultado?: { error?: string } }
      if (parcial?.errores?.length || parcial?.resultados?.some(r => r.error || r.newRelic?.error) || parcial?.resultado?.error) {
        notificar('La operación terminó con errores. Revisa el detalle en el formulario.', 'aviso')
      } else notificar(mensajeAccion(ruta, metodo))
    }
    return datos
  } catch (error) {
    if (mostrar && !(error instanceof DOMException && error.name === 'AbortError')) {
      notificar(error instanceof Error ? error.message : 'No se pudo completar la operación', 'error')
    }
    throw error
  }
}

// fetch con la cookie de sesion; si la respuesta no es OK lanza ErrorApi con el mensaje del backend
async function llamar(ruta: string, opciones: RequestInit): Promise<Response> {
  const headers = new Headers(opciones.headers)
  // JSON por defecto; un archivo (Blob) viaja con su propio tipo, ej. image/png
  if (opciones.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', opciones.body instanceof Blob ? opciones.body.type : 'application/json')
  }

  const respuesta = await fetch(`/api${ruta}`, {
    ...opciones,
    headers,
    credentials: 'same-origin',
  })

  if (respuesta.ok) {
    return respuesta
  }

  if (respuesta.status === 401 && !ruta.startsWith('/auth/')) {
    alExpirar?.()
  }

  const error = await respuesta.json().catch(() => null) as RespuestaError | null
  const mensaje = error?.mensaje
    ?? error?.errores?.map((e) => `${e.path ?? 'campo'}: ${e.msg}`).join(', ')
    ?? `Error ${respuesta.status}`
  throw new ErrorApi(mensaje, respuesta.status)
}
