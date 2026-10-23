import { useRespuestaTiempoReal } from './useRespuestaTiempoReal.ts'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ejecutarWatcher, guardarWatcher, obtenerWatcher, type EstadoWatcher } from '../api/auditoria.ts'
import DuplicadosExistentes from './DuplicadosExistentes.tsx'
import ProgramacionLimpieza from './ProgramacionLimpieza.tsx'

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Bogota',
})

const fecha = (valor: string | null) => (valor ? formatoFecha.format(new Date(valor)) : '—')

// Mientras el modal esta abierto, el estado se refresca solo
const REFRESCO_MS = 10000

// Programacion: watcher de rechazos (SendGrid -> Mongo -> New Relic) y eliminacion de registros antiguos.
// Son parametros en Mongo (configuracionsitio); no dependen del .env y aplican de inmediato.
export default function ModalWatcher({ onCerrar }: { onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [estado, setEstado] = useState<EstadoWatcher | null>(null)
  useRespuestaTiempoReal<EstadoWatcher>('/sendgrid/auditoria/watcher', setEstado)
  const [activo, setActivo] = useState(true)
  const [cadaMinutos, setCadaMinutos] = useState('5')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    dialogo.current?.showModal()
    obtenerWatcher()
      .then((e) => {
        setEstado(e)
        setActivo(e.programacion.activo)
        setCadaMinutos(String(e.programacion.cadaMinutos))
      })
      .catch((err) => setError(mensajeDe(err, 'No se pudo cargar el watcher')))

    const intervalo = setInterval(() => {
      obtenerWatcher().then(setEstado).catch(() => {})
    }, REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const minutos = Number(cadaMinutos)
  const minutosValidos = Number.isInteger(minutos) && minutos >= 1 && minutos <= 1440
  const sinCambios = estado !== null
    && activo === estado.programacion.activo && minutos === estado.programacion.cadaMinutos

  // Motivo por el que "Guardar programacion" esta deshabilitado (null = habilitado)
  const motivoGuardar = guardando ? null
    : !minutosValidos ? 'Ejecutar cada debe ser un número entero entre 1 y 1440 minutos.'
      : sinCambios ? 'No hay cambios por guardar.'
        : null

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setMensaje(null)
    setGuardando(true)
    try {
      setEstado(await guardarWatcher({ activo, cadaMinutos: minutos }))
      setMensaje(activo ? `Watcher programado cada ${minutos} min` : 'Watcher pausado')
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la programación'))
    } finally {
      setGuardando(false)
    }
  }

  const ejecutar = async () => {
    setError(null)
    setMensaje(null)
    try {
      setEstado(await ejecutarWatcher())
      setMensaje('Vuelta iniciada; el estado se actualiza solo')
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo ejecutar el watcher'))
    }
  }

  const r = estado?.resultado
  const nr = estado?.newRelic

  return (
    <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-programacion">
      <div className="modal-cabecera">
        <h2 id="titulo-programacion">Programación</h2>
        <button type="button" className="secundario" onClick={() => dialogo.current?.close()}>Cerrar</button>
      </div>

      <h3 className="subtitulo-modal">Sincronización (watcher)</h3>
      <p className="ayuda">
        En cada vuelta sincroniza SendGrid → MongoDB en las bases activas, sin duplicados (una misma factura,
        destinatario y estado se guarda una sola vez), y envía a New Relic los rechazos pendientes (un evento
        por destinatario y estado).
      </p>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      <form className="form-rutas" onSubmit={guardar}>
        <label className="campo-check">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activo
        </label>
        <div className="campo">
          <label htmlFor="watcher-minutos">Ejecutar cada (minutos)</label>
          <input
            id="watcher-minutos"
            type="number"
            min={1}
            max={1440}
            step={1}
            value={cadaMinutos}
            onChange={(e) => setCadaMinutos(e.target.value)}
            disabled={!activo}
            required
          />
        </div>
        <div className="acciones-form">
          <button type="submit" disabled={guardando || !minutosValidos || sinCambios} title={motivoGuardar ?? undefined}>
            {guardando ? 'Guardando…' : 'Guardar programación'}
          </button>
          <button type="button" className="secundario" onClick={ejecutar} disabled={!estado || estado.enCurso}
            title={estado?.enCurso ? 'Ya hay una vuelta en curso' : undefined}>
            {estado?.enCurso ? 'Ejecutando…' : 'Ejecutar ahora'}
          </button>
        </div>
      </form>
      {motivoGuardar && (
        <ul className="motivos-deshabilitado" role="status">
          <li><strong>Guardar programación:</strong> {motivoGuardar}</li>
        </ul>
      )}

      {estado && (
        <div className="tabla-scroll">
          <table>
            <tbody>
              <tr>
                <th>Estado</th>
                <td>
                  {estado.enCurso
                    ? <span className="estado estado-deferred">Ejecutando una vuelta…</span>
                    : estado.programacion.activo
                      ? <span className="estado estado-delivered">Activo · cada {estado.programacion.cadaMinutos} min</span>
                      : <span className="estado estado-dropped">Pausado</span>}
                </td>
              </tr>
              <tr>
                <th>Última vuelta</th>
                <td>
                  {fecha(estado.ultimaEjecucion)}
                  {estado.duracionMs !== null && ` · ${(estado.duracionMs / 1000).toFixed(1)} s`}
                </td>
              </tr>
              <tr>
                <th>Próxima vuelta</th>
                <td>{fecha(estado.proximaEjecucion)}</td>
              </tr>
              <tr>
                <th>Resultado</th>
                <td className="respuesta">
                  {!r ? '—' : r.error ? <span className="estado estado-dropped">{r.error}</span> : (
                    <>
                      {r.bases} base(s) · {r.insertados} rechazo(s) nuevo(s) · {r.duplicadosOmitidos ?? 0} duplicado(s) omitido(s)
                      {' · '}{r.actualizados} actualizado(s)
                      {' · '}{r.deferredResueltos} deferred resuelto(s)
                      {r.basesConError?.map((b) => (
                        <div key={b.baseDatos}><span className="estado estado-dropped">{b.baseDatos}:</span> {b.error}</div>
                      ))}
                      {r.newRelic && (
                        <div>
                          New Relic: {r.newRelic.enviados} enviado(s) · {r.newRelic.omitidos} omitido(s)
                          {r.newRelic.error && <> · <span className="estado estado-dropped">{r.newRelic.error}</span></>}
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
              {nr && (
                <tr>
                  <th>New Relic (MongoDB)</th>
                  <td className="respuesta">
                    {nr.configurado ? (
                      <>
                        {nr.total} rechazo(s) · {nr.enviados} enviado(s) · {nr.omitidos} omitido(s) ·{' '}
                        <strong>{nr.pendientes} pendiente(s)</strong> · último envío {fecha(nr.ultimoEnvio)}
                      </>
                    ) : <span className="estado estado-dropped">{nr.problema}</span>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <hr className="separador" />
      <ProgramacionLimpieza />

      <hr className="separador" />
      <DuplicadosExistentes />
    </dialog>
  )
}
