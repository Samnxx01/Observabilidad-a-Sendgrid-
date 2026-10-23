import { useRespuestaTiempoReal } from './useRespuestaTiempoReal.ts'
import { useConfirmar } from './useConfirmar.ts'
import { useEffect, useState, type FormEvent } from 'react'
import { ejecutarLimpieza, guardarLimpieza, obtenerLimpieza, type EstadoLimpieza } from '../api/auditoria.ts'

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

const fecha = (valor: string | null) => (valor ? formatoFecha.format(new Date(valor)) : '—')

// SendGrid guarda 30 dias: con menos, la sincronizacion volveria a traer lo borrado
const MIN_DIAS = 31
const MAX_DIAS = 3650

// Igual que el backend (src/auditoria/limpieza.js)
const LIMITES_FRECUENCIA = { horas: { min: 1, max: 168 }, dias: { min: 1, max: 365 } }

const HORAS = Array.from({ length: 24 }, (_, h) => h)
const textoHora = (h: number) => `${String(h).padStart(2, '0')}:00`

// Eliminacion programada de rechazos antiguos (parametro en Mongo: configuracionsitio.limpieza)
export default function ProgramacionLimpieza() {
  const confirmar = useConfirmar()
  const [estado, setEstado] = useState<EstadoLimpieza | null>(null)
  useRespuestaTiempoReal<EstadoLimpieza>('/sendgrid/auditoria/limpieza', setEstado)
  const [activo, setActivo] = useState(false)
  const [dias, setDias] = useState('90')
  const [hora, setHora] = useState(2)
  const [unidad, setUnidad] = useState<'horas' | 'dias'>('dias')
  const [cada, setCada] = useState('1')
  const [vistaPrevia, setVistaPrevia] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    obtenerLimpieza()
      .then((e) => {
        setEstado(e)
        setActivo(e.programacion.activo)
        setDias(String(e.programacion.diasRetencion))
        setHora(e.programacion.hora)
        setUnidad(e.programacion.unidad ?? 'dias')
        setCada(String(e.programacion.cada ?? 1))
        setVistaPrevia(e.eliminables)
      })
      .catch((err) => setError(mensajeDe(err, 'No se pudo cargar la limpieza')))
  }, [])

  const diasNumero = Number(dias)
  const diasValidos = Number.isInteger(diasNumero) && diasNumero >= MIN_DIAS && diasNumero <= MAX_DIAS

  // Vista previa: cuantos se borrarian con la retencion escrita (aun sin guardar)
  useEffect(() => {
    if (!estado || !diasValidos) return
    const espera = setTimeout(() => {
      obtenerLimpieza(diasNumero).then((e) => setVistaPrevia(e.eliminables)).catch(() => {})
    }, 400)
    return () => clearTimeout(espera)
  }, [diasNumero, diasValidos, estado])

  const cadaNumero = Number(cada)
  const limites = LIMITES_FRECUENCIA[unidad]
  const cadaValido = Number.isInteger(cadaNumero) && cadaNumero >= limites.min && cadaNumero <= limites.max

  const sinCambios = estado !== null && activo === estado.programacion.activo
    && diasNumero === estado.programacion.diasRetencion && hora === estado.programacion.hora
    && unidad === (estado.programacion.unidad ?? 'dias') && cadaNumero === (estado.programacion.cada ?? 1)

  // Motivo por el que cada boton esta deshabilitado (null = habilitado), visible bajo los botones
  const motivoGuardar = ocupado ? null
    : !diasValidos ? `Conservar debe ser un número entero entre ${MIN_DIAS} y ${MAX_DIAS} días.`
      : !cadaValido ? `"Cada" debe ser un número entero entre ${limites.min} y ${limites.max} ${unidad === 'horas' ? 'horas' : 'días'}.`
        : sinCambios ? 'No hay cambios por guardar.'
          : null
  const motivoEliminar = ocupado || !estado ? null
    : estado.enCurso ? 'Ya hay una eliminación en curso.'
      : !sinCambios ? `Guarda la programación antes de eliminar (la guardada conserva ${estado.programacion.diasRetencion} días).`
        : estado.eliminables === 0 ? `No hay rechazos con más de ${estado.programacion.diasRetencion} días para eliminar.`
          : null

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setMensaje(null)
    setOcupado(true)
    try {
      const nuevo = await guardarLimpieza({ activo, diasRetencion: diasNumero, unidad, cada: cadaNumero, hora })
      setEstado(nuevo)
      setMensaje(activo
        ? `Limpieza programada ${nuevo.frecuencia}: se conservan ${diasNumero} días`
        : 'Limpieza pausada')
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la programación'))
    } finally {
      setOcupado(false)
    }
  }

  const eliminarAhora = async () => {
    if (!estado) return
    const { diasRetencion } = estado.programacion
    if (!await confirmar(`¿Eliminar ya ${estado.eliminables} rechazo(s) con más de ${diasRetencion} días? `
      + 'Esta acción no se puede deshacer.')) {
      return
    }
    setError(null)
    setMensaje(null)
    setOcupado(true)
    try {
      const nuevo = await ejecutarLimpieza()
      setEstado(nuevo)
      setVistaPrevia(nuevo.eliminables)
      setMensaje(nuevo.resultado?.error
        ? null
        : `${nuevo.resultado?.eliminados ?? 0} rechazo(s) eliminado(s)`)
      if (nuevo.resultado?.error) setError(nuevo.resultado.error)
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo eliminar'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-labelledby="titulo-limpieza">
      <h3 id="titulo-limpieza" className="subtitulo-modal">Eliminación de registros de auditoría</h3>
      <p className="ayuda">
        Borra de MongoDB los rechazos con fecha de envío más antigua que la retención, con la frecuencia que
        elijas: cada N horas, o cada N días a la hora indicada (Colombia). Retención mínima {MIN_DIAS} días,
        porque SendGrid guarda 30 y con menos la sincronización los volvería a traer.
        {estado?.conservaPendientesNewRelic && ' Los rechazos pendientes de enviar a New Relic no se borran.'}
      </p>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      <form className="form-rutas" onSubmit={guardar}>
        <label className="campo-check">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activa
        </label>
        <div className="campo">
          <label htmlFor="limpieza-dias">Conservar (días)</label>
          <input
            id="limpieza-dias"
            type="number"
            min={MIN_DIAS}
            max={MAX_DIAS}
            step={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            required
            aria-invalid={!diasValidos}
            aria-describedby="limpieza-dias-ayuda"
          />
          {!diasValidos && (
            <small id="limpieza-dias-ayuda" className="ayuda texto-error">Mínimo {MIN_DIAS} y máximo {MAX_DIAS} días.</small>
          )}
        </div>
        <div className="campo campo-frecuencia">
          <label htmlFor="limpieza-cada">Ejecutar cada</label>
          <div className="frecuencia">
            <input
              id="limpieza-cada"
              type="number"
              min={limites.min}
              max={limites.max}
              step={1}
              value={cada}
              onChange={(e) => setCada(e.target.value)}
              disabled={!activo}
              required
              aria-invalid={!cadaValido}
            />
            <select aria-label="Unidad de la frecuencia" value={unidad} disabled={!activo}
              onChange={(e) => setUnidad(e.target.value as 'horas' | 'dias')}>
              <option value="horas">horas</option>
              <option value="dias">días</option>
            </select>
          </div>
          {!cadaValido && (
            <small className="ayuda texto-error">Entre {limites.min} y {limites.max} {unidad === 'horas' ? 'horas' : 'días'}.</small>
          )}
        </div>
        {unidad === 'dias' && (
          <div className="campo">
            <label htmlFor="limpieza-hora">A la hora</label>
            <select id="limpieza-hora" value={hora} onChange={(e) => setHora(Number(e.target.value))} disabled={!activo}>
              {HORAS.map((h) => <option key={h} value={h}>{textoHora(h)}</option>)}
            </select>
          </div>
        )}
        <div className="acciones-form">
          <button type="submit" disabled={ocupado || !diasValidos || !cadaValido || sinCambios} title={motivoGuardar ?? undefined}>
            {ocupado ? 'Guardando…' : 'Guardar programación'}
          </button>
          <button
            type="button"
            className="secundario peligro"
            onClick={eliminarAhora}
            disabled={ocupado || !estado || estado.enCurso || estado.eliminables === 0 || !sinCambios}
            title={motivoEliminar ?? 'Elimina ya con la retención guardada'}
          >
            Eliminar ahora
          </button>
        </div>
      </form>
      {(motivoGuardar || motivoEliminar) && (
        <ul className="motivos-deshabilitado" role="status">
          {motivoGuardar && <li><strong>Guardar programación:</strong> {motivoGuardar}</li>}
          {motivoEliminar && <li><strong>Eliminar ahora:</strong> {motivoEliminar}</li>}
        </ul>
      )}

      {estado && (
        <div className="tabla-scroll">
          <table>
            <tbody>
              <tr>
                <th>Estado</th>
                <td>
                  {estado.programacion.activo
                    ? <span className="estado estado-delivered">
                        Activa · {estado.frecuencia} · conserva {estado.programacion.diasRetencion} días
                      </span>
                    : <span className="estado estado-dropped">Pausada</span>}
                </td>
              </tr>
              <tr>
                <th>Se eliminarían hoy</th>
                <td>
                  {diasValidos && vistaPrevia !== null
                    ? <><strong>{vistaPrevia}</strong> rechazo(s) con más de {diasNumero} días</>
                    : '—'}
                </td>
              </tr>
              <tr>
                <th>Próxima ejecución</th>
                <td>{fecha(estado.proximaEjecucion)}</td>
              </tr>
              <tr>
                <th>Última ejecución</th>
                <td>
                  {fecha(estado.ultimaEjecucion)}
                  {estado.resultado && (estado.resultado.error
                    ? <> · <span className="estado estado-dropped">{estado.resultado.error}</span></>
                    : ` · ${estado.resultado.eliminados} eliminado(s)`)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
