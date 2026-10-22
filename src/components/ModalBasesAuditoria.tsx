import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  actualizarBase,
  crearBase,
  eliminarBase,
  obtenerBases,
  type BaseAuditoria,
  type DatosBase,
} from '../api/auditoria.ts'

const VACIO: DatosBase = { baseDatos: '', fechaInicial: '', activo: true }

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

// SendGrid solo guarda 30 dias: no se puede sincronizar desde antes (ver backend/src/auditoria/sincronizar.js)
const DIAS_HISTORIAL_SENDGRID = 30

// 'YYYY-MM-DD' en hora Colombia, n dias atras
const diaColombia = (diasAtras = 0) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' })
    .format(new Date(Date.now() - diasAtras * 24 * 3600 * 1000))

const formatoDia = (dia: string) => dia.split('-').reverse().join('/')

// Bases de Azure SQL que se auditan en SendGrid y desde que fecha (coleccion basesauditoria).
// Reemplaza SQL_DATABASES y FECHAINITIAL del .env.
export default function ModalBasesAuditoria({ onCerrar }: { onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [bases, setBases] = useState<BaseAuditoria[]>([])
  const [form, setForm] = useState<DatosBase>(VACIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Rango permitido para la fecha inicial (hora Colombia)
  const hoy = diaColombia()
  const fechaMinima = diaColombia(DIAS_HISTORIAL_SENDGRID - 1)

  useEffect(() => {
    dialogo.current?.showModal()
    obtenerBases()
      .then(setBases)
      .catch((err) => setError(mensajeDe(err, 'No se pudieron cargar las bases')))
      .finally(() => setCargando(false))
  }, [])

  const cambiar = <K extends keyof DatosBase>(campo: K, valor: DatosBase[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  const limpiar = () => {
    setForm(VACIO)
    setEditandoId(null)
  }

  const editar = (base: BaseAuditoria) => {
    // Una fecha guardada que ya salio de los 30 dias se sube al minimo permitido
    const minimo = diaColombia(DIAS_HISTORIAL_SENDGRID - 1)
    const fechaInicial = base.fechaInicial < minimo ? minimo : base.fechaInicial
    setForm({ baseDatos: base.baseDatos, fechaInicial, activo: base.activo })
    setEditandoId(base.id)
    setError(null)
    setMensaje(null)
  }

  // El backend se conecta a la base y lee su empresa de INEMPRESU antes de guardar
  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setMensaje(null)
    setGuardando(true)
    try {
      const datos = { ...form, baseDatos: form.baseDatos.trim().toUpperCase() }
      const base = editandoId ? await actualizarBase(editandoId, datos) : await crearBase(datos)
      setMensaje(`Base ${base.baseDatos} guardada · ${base.nombre ?? ''} (NIT ${base.nit})`)
      limpiar()
      setBases(await obtenerBases())
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la base'))
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (base: BaseAuditoria) => {
    if (!window.confirm(`¿Quitar ${base.baseDatos} de la auditoría? Los rechazos ya guardados se conservan.`)) {
      return
    }
    setError(null)
    setMensaje(null)
    try {
      await eliminarBase(base.id)
      if (editandoId === base.id) {
        limpiar()
      }
      setMensaje(`Base ${base.baseDatos} eliminada`)
      setBases(await obtenerBases())
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo eliminar la base'))
    }
  }

  return (
    <dialog ref={dialogo} className="modal" onClose={onCerrar} aria-labelledby="titulo-bases">
      <div className="modal-cabecera">
        <h2 id="titulo-bases">Bases a sincronizar</h2>
        <button type="button" className="secundario" onClick={() => dialogo.current?.close()}>Cerrar</button>
      </div>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      <form className="form-rutas" onSubmit={guardar}>
        <div className="campo">
          <label htmlFor="base-nombre">Base de datos SQL</label>
          <input
            id="base-nombre"
            value={form.baseDatos}
            onChange={(e) => cambiar('baseDatos', e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
            placeholder="INDIGO545"
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="base-fecha">Fecha inicial</label>
          <input
            id="base-fecha"
            type="date"
            value={form.fechaInicial}
            min={fechaMinima}
            max={hoy}
            onChange={(e) => cambiar('fechaInicial', e.target.value)}
            aria-describedby="base-fecha-ayuda"
            required
          />
          <small id="base-fecha-ayuda" className="ayuda">
            Hasta {DIAS_HISTORIAL_SENDGRID - 1} días atrás: desde el {formatoDia(fechaMinima)}
          </small>
        </div>
        <label className="campo-check">
          <input type="checkbox" checked={form.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
          Activa
        </label>
        <div className="acciones-form">
          <button type="submit" disabled={guardando || !form.baseDatos || !form.fechaInicial}>
            {guardando ? 'Conectando…' : editandoId ? 'Guardar cambios' : 'Agregar base'}
          </button>
          {editandoId && <button type="button" className="secundario" onClick={limpiar}>Cancelar</button>}
        </div>
      </form>

      <p className="alerta alerta-info">
        SendGrid solo guarda {DIAS_HISTORIAL_SENDGRID} días de historial, por eso la fecha inicial permite como
        máximo {DIAS_HISTORIAL_SENDGRID - 1} días atrás (desde el {formatoDia(fechaMinima)} hasta hoy). Las
        sincronizaciones siguientes solo traen lo nuevo.
      </p>

      {cargando ? (
        <p className="cargando" role="status">Cargando…</p>
      ) : bases.length === 0 ? (
        <p className="vacio">No hay bases configuradas.</p>
      ) : (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Base</th>
                <th>Empresa</th>
                <th>Fecha inicial</th>
                <th>Estado</th>
                <th>Última sincronización</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {bases.map((b) => (
                <tr key={b.id} className={editandoId === b.id ? 'fila-editando' : undefined}>
                  <td>{b.baseDatos}</td>
                  <td>{b.nombre}<br />{b.nit}</td>
                  <td>{b.fechaInicial}</td>
                  <td>{b.activo ? 'Activa' : <span className="estado estado-deferred">Inactiva</span>}</td>
                  <td className="respuesta">
                    {b.ultimaSincronizacion ? formatoFecha.format(new Date(b.ultimaSincronizacion)) : 'Nunca'}
                    {b.ultimoError && <><br /><span className="estado estado-dropped">Error:</span> {b.ultimoError}</>}
                  </td>
                  <td className="acciones">
                    <button type="button" className="secundario" onClick={() => editar(b)}>Editar</button>
                    <button type="button" className="secundario peligro" onClick={() => borrar(b)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </dialog>
  )
}
