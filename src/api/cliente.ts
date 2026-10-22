export interface Usuario {
  id: string
  correo: string
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
export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await llamar(ruta, opciones)
  if (respuesta.status === 204) {
    return undefined as T
  }
  return respuesta.json().catch(() => null) as Promise<T>
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
