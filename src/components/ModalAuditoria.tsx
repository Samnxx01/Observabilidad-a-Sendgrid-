import { useRespuestaTiempoReal } from './useRespuestaTiempoReal.ts'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { obtenerAuditoriaComponente, obtenerComponentesAuditoria, type HistorialAuditoria } from '../api/auditoriaUsuarios.ts'
import RetencionAuditoria from './RetencionAuditoria.tsx'
const ETIQUETAS: Record<string, string> = {
  ConfiguracionApariencia: 'Apariencia de la aplicación',
  ConfiguracionRutas: 'Configuración de rutas', RegistroRoles: 'Registro de roles', AsignacionRoles: 'Asignación de roles',
  ConfiguracionLogo: 'Logo de la web', ConfiguracionInicio: 'Página de inicio', ConfiguracionSitio: 'Configuración del sitio',
  ConsultaNotificaciones: 'Notificaciones de facturas', EventosRechazos: 'Eventos de rechazos', BasesAuditoria: 'Bases de auditoría',
  LimpiezaAuditoria: 'Limpieza de auditoría', DuplicadosExistentes: 'Duplicados', EstadoServicios: 'Estado de servicios',
  AuditoriaUsuarios: 'Consulta de auditoría', Sesion: 'Sesión', Login: 'Inicio de sesión', Registro: 'Registro de usuarios',
  OtrosEndpoints: 'Otros endpoints', Watcher: 'Sincronización programada', NewRelic: 'New Relic', Facturas: 'Facturas SendGrid',
}
const CAMBIOS: Record<string, string> = {
  MODIFICADO: 'Modificado', SIN_CAMBIOS: 'Sin cambios', CREADO: 'Creado',
  NO_APLICA: 'No aplica', NO_DETERMINADO: 'Sin verificar', NO_CONFIRMADO: 'No confirmado',
}
const ESTADOS: Record<string, string> = { PENDIENTE: 'Pendiente', EXITO: 'Correcto', ERROR: 'Error', DENEGADO: 'Acceso denegado', INTERRUMPIDO: 'Interrumpido' }
const fecha = (valor: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(valor))
export default function ModalAuditoria({ onCerrar }: { onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [componentes, setComponentes] = useState<string[]>([])
  const [componente, setComponente] = useState('ConfiguracionRutas')
  const [consulta, setConsulta] = useState({ componente: 'ConfiguracionRutas', pagina: 1, version: 0 })
  const [historial, setHistorial] = useState<HistorialAuditoria | null>(null)
  useRespuestaTiempoReal<HistorialAuditoria>(`/auditoria-usuarios/${encodeURIComponent(consulta.componente)}?pagina=${consulta.pagina}&limite=20`, setHistorial)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verRetencion, setVerRetencion] = useState(false)
  useEffect(() => {
    const modal = dialogo.current
    if (modal && !modal.open) modal.showModal()
  }, [])
  useEffect(() => {
    const abortar = new AbortController()
    Promise.all([obtenerComponentesAuditoria(abortar.signal), obtenerAuditoriaComponente(consulta.componente, consulta.pagina, abortar.signal)])
      .then(([catalogo, datos]) => {
        if (abortar.signal.aborted) return
        setComponentes(catalogo)
        setHistorial(datos)
      })
      .catch((err: unknown) => { if (!abortar.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría') })
      .finally(() => { if (!abortar.signal.aborted) setCargando(false) })
    return () => abortar.abort()
  }, [consulta])
  const cargar = (valor: string, pagina: number) => {
    setError(null)
    setHistorial(null)
    setCargando(true)
    setConsulta(actual => ({ componente: valor, pagina, version: actual.version + 1 }))
  }
  const buscar = (evento: FormEvent<HTMLFormElement>) => { evento.preventDefault(); cargar(componente, 1) }
  const paginas = historial ? Math.max(1, Math.ceil(historial.total / historial.limite)) : 1
  return (
    <dialog ref={dialogo} className="modal modal-auditoria" aria-labelledby="titulo-auditoria" onClose={onCerrar}>
      <div className="modal-cabecera">
        <h2 id="titulo-auditoria">Auditoría por componente</h2>
        <button type="button" className="secundario" onClick={() => dialogo.current?.close()}>Cerrar</button>
      </div>
      <form className="busqueda" onSubmit={buscar}>
        <div className="campo">
          <label htmlFor="auditoria-componente">Componente</label>
          <select id="auditoria-componente" value={componente} onChange={e => setComponente(e.target.value)}>
            {(componentes.length ? componentes : ['ConfiguracionRutas']).map(valor => <option key={valor} value={valor}>{ETIQUETAS[valor] ?? valor}</option>)}
          </select>
        </div>
        <div className="acciones-form">
          <button type="submit" disabled={cargando}>{cargando ? 'Consultando...' : 'Consultar auditoría'}</button>
          <button type="button" className="secundario" aria-expanded={verRetencion} onClick={() => setVerRetencion(v => !v)}
            title="Cuántos días se conserva la auditoría de cada componente y acción antes de eliminarse">
            {verRetencion ? 'Ocultar tiempo de eliminación' : 'Tiempo de eliminación'}
          </button>
        </div>
      </form>
      {verRetencion && <RetencionAuditoria etiquetas={ETIQUETAS} componenteActual={componente} />}
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {cargando && <p role="status">Cargando historial...</p>}
      {!cargando && historial && <>
        <p className="resumen">{ETIQUETAS[historial.formulario] ?? historial.formulario}: {historial.total} registro(s)</p>
        <p className="ayuda">Fechas en hora Colombia. Pendiente indica que la solicitud aún no tiene un resultado registrado.</p>
        {historial.registros.length === 0 ? <p>No hay auditorías para este componente.</p> : <div className="tabla-scroll">
          <table>
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Endpoint</th><th>Resultado</th><th>Cambio en datos</th><th>HTTP</th><th>Duración</th></tr></thead>
            <tbody>{historial.registros.map(registro => <tr key={registro.solicitudId}>
              <td>{fecha(registro.fecha)}</td>
              <td>{registro.correo ?? (registro.autenticado ? 'Usuario autenticado' : 'Sin sesión')}</td>
              <td>{registro.accion.replaceAll('_', ' ')}</td>
              <td className="auditoria-endpoint"><code>{registro.metodo} {registro.endpoint}</code><small className="ayuda">{registro.solicitudId}</small></td>
              <td>{ESTADOS[registro.estado] ?? registro.estado}</td>
              <td>{registro.cambioDatos ? CAMBIOS[registro.cambioDatos] ?? registro.cambioDatos : 'Sin información'}</td>
              <td>{registro.codigoHttp ?? '-'}</td>
              <td>{registro.duracionMs === undefined ? '-' : `${registro.duracionMs} ms`}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="paginacion">
          <button type="button" className="secundario" disabled={historial.pagina <= 1} onClick={() => cargar(historial.formulario, historial.pagina - 1)}>Anterior</button>
          <span>Página {historial.pagina} de {paginas}</span>
          <button type="button" className="secundario" disabled={historial.pagina >= paginas || historial.pagina >= 10000} onClick={() => cargar(historial.formulario, historial.pagina + 1)}>Siguiente</button>
        </div>
      </>}
    </dialog>
  )
}
