import { publicarConexion, useConexionTiempoReal } from '../utils/conexionTiempoReal.ts'
import { useEffect, useEffectEvent } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../auth/useAuth.ts'
import { api } from '../api/cliente.ts'
import { limpiarConsultas, refrescarConsultas } from '../api/tiempoReal.ts'
import { cargarSitio } from '../sitio/sitio.ts'
import { cargarTema } from '../sitio/tema.ts'
import { useRutas } from '../rutas/useRutas.ts'
export default function TiempoReal() {
  const { usuario } = useAuth()
  const { recargar } = useRutas()
  const recargarRutas = useEffectEvent(() => recargar())
  useEffect(() => {
    const socket = io({ withCredentials: true })
    let timer: ReturnType<typeof setTimeout> | undefined
    const refrescar = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void refrescarConsultas((ruta, opciones) => api(ruta, {...opciones, notificar:false}))
        void cargarSitio()
        void cargarTema().catch(() => {})
        void recargarRutas()
      }, 300)
    }
    socket.on('connect', () => { publicarConexion(true); refrescar() })
    socket.on('disconnect', () => publicarConexion(false))
    socket.on('connect_error', () => publicarConexion(false))
    socket.on('datos:cambiados', refrescar)
    return () => { clearTimeout(timer); socket.disconnect(); publicarConexion(false); limpiarConsultas() }
  }, [usuario?.id])
  return null
}
export function EstadoConexion() {
  const conectado = useConexionTiempoReal()
  return <span className="conexion-tiempo-real" role="status">{conectado ? 'En tiempo real' : 'Reconectando...'}</span>
}
