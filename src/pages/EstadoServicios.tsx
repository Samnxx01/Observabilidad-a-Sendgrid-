import { useRespuestaTiempoReal } from '../components/useRespuestaTiempoReal.ts'
import { useEffect, useState } from 'react'
import { obtenerEstadoServicios, type EstadoServicios as Estado } from '../api/servicios.ts'
import { AyudaServicios } from '../components/AyudasEstados.tsx'
const ESTADOS: Record<string, string> = {
  no_autorizado: 'Clave rechazada', acceso_denegado: 'Acceso denegado', limitado: 'Limite de peticiones',
  tiempo_agotado: 'Tiempo agotado', sin_conexion: 'Sin conexion',
  disponible: 'Disponible', configurado: 'Configurado', sin_configurar: 'Sin configurar',
  desconectado: 'Desconectado', conectando: 'Conectando', desconectando: 'Desconectando',
  desconocido: 'Desconocido', sin_conexiones: 'Sin conexiones', error: 'Con errores',
  ejecutando: 'En curso', programado: 'Programado', inactivo: 'Inactivo',
}
const fecha = (valor: string) => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Bogota',
}).format(new Date(valor))
export default function EstadoServicios() {
  const [datos, setDatos] = useState<Estado | null>(null)
  useRespuestaTiempoReal<Estado>('/servicios', setDatos)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const abortar = new AbortController()
    obtenerEstadoServicios(abortar.signal)
      .then(respuesta => { if (!abortar.signal.aborted) setDatos(respuesta) })
      .catch((err: unknown) => { if (!abortar.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo consultar el estado') })
      .finally(() => { if (!abortar.signal.aborted) setCargando(false) })
    return () => abortar.abort()
  }, [version])
  const actualizar = () => { setError(null); setCargando(true); setVersion(v => v + 1) }
  return (
    <main className="contenido">
      <div className="configuracion-cabecera">
        <div className="titulo-con-ayuda"><h1>Estado de servicios</h1><AyudaServicios /></div>
        <button type="button" disabled={cargando} onClick={actualizar}>{cargando ? 'Actualizando...' : 'Actualizar estado'}</button>
      </div>
      <p>SendGrid se comprueba con una consulta autenticada a su API. Las otras tarjetas muestran conexiones, procesos o configuración del backend.</p>
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {cargando && <p role="status">Consultando estado de servicios...</p>}
      {datos && <>
        <p className="ayuda">{error ? 'Ultima lectura disponible' : 'Lectura'}: {fecha(datos.actualizadoEn)} (Colombia). Tiempo activo del backend: {Math.floor(datos.uptimeSegundos / 60)} min.</p>
        <div className="servicios-grid" aria-busy={cargando}>
          {datos.servicios.map(servicio => <article className="servicio-tarjeta" key={servicio.id}>
            <div className="servicio-titulo"><h2>{servicio.nombre}</h2><span className={`servicio-estado servicio-${servicio.estado}`}>{ESTADOS[servicio.estado] ?? servicio.estado}</span></div>
            <p>{servicio.detalle}</p>
            {servicio.comprobadoEn && <p className="ayuda">Comprobado: {fecha(servicio.comprobadoEn)}</p>}
            {servicio.codigoHttp !== undefined && <p className="ayuda">HTTP {servicio.codigoHttp}{servicio.latenciaMs !== undefined ? ` ? ${servicio.latenciaMs} ms` : ''}</p>}
            {servicio.ultimaEjecucion && <p className="ayuda">Ultima ejecución: {fecha(servicio.ultimaEjecucion)}</p>}
            {servicio.proximaEjecucion && <p className="ayuda">Próxima ejecución: {fecha(servicio.proximaEjecucion)}</p>}
            {servicio.conexiones && servicio.conexiones.length > 0 && <ul>{servicio.conexiones.map(conexion => <li key={conexion.baseDatos}>{conexion.baseDatos}: {ESTADOS[conexion.estado] ?? conexion.estado}</li>)}</ul>}
          </article>)}
        </div>
      </>}
    </main>
  )
}
