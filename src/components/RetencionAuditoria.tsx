import { useEffect, useState } from 'react'
import {
  ejecutarRetencion,
  guardarRetencion,
  obtenerRetencion,
  type EstadoRetencion,
  type ReglaRetencion,
} from '../api/auditoriaUsuarios.ts'
import SeleccionMultiple from './SeleccionMultiple.tsx'
import { useConfirmar } from './useConfirmar.ts'

const TODAS = '*'
const MAX_DIAS = 3650

// Una fila de la pantalla: la misma accion, dias y estado para uno o varios componentes.
// En el backend se guarda una regla por componente.
interface Fila {
  id: number
  formularios: string[]
  accion: string
  dias: number
  activo: boolean
}

let siguienteId = 1

// Reglas del backend -> filas: agrupa las que comparten accion, dias y estado
const agrupar = (reglas: ReglaRetencion[]): Fila[] => {
  const grupos = new Map<string, Fila>()
  for (const r of reglas) {
    const clave = `${r.accion}|${r.dias}|${r.activo}`
    const fila = grupos.get(clave)
    if (fila) fila.formularios.push(r.formulario)
    else grupos.set(clave, { id: siguienteId++, formularios: [r.formulario], accion: r.accion, dias: r.dias, activo: r.activo })
  }
  return [...grupos.values()]
}

// Filas -> una regla por componente (lo que espera el backend)
const expandir = (filas: Fila[]): ReglaRetencion[] =>
  filas.flatMap((f) => f.formularios.map((formulario) => ({ formulario, accion: f.accion, dias: f.dias, activo: f.activo })))

const clave = (r: Pick<ReglaRetencion, 'formulario' | 'accion'>) => `${r.formulario}|${r.accion}`

// Compara solo lo editable y sin importar el orden
const firma = (reglas: ReglaRetencion[]) =>
  JSON.stringify(reglas.map((r) => `${clave(r)}|${r.dias}|${r.activo}`).sort())

const fecha = (valor: string | null) => (valor
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(valor))
  : '—')

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

interface Props {
  // Nombre legible de cada componente (las mismas etiquetas del modal de auditoria)
  etiquetas: Record<string, string>
  // Componente elegido en el modal: se propone al agregar una regla
  componenteActual: string
}

// Cuanto tiempo se conserva la auditoria de usuarios de cada componente (y accion) antes de eliminarse
export default function RetencionAuditoria({ etiquetas, componenteActual }: Props) {
  const confirmar = useConfirmar()
  const [estado, setEstado] = useState<EstadoRetencion | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // Si una respuesta no trae los catalogos (componentes, acciones), se conservan los que ya habia
  const aplicar = (nuevo: EstadoRetencion) => {
    setEstado((anterior) => ({
      ...nuevo,
      reglas: nuevo.reglas ?? [],
      componentes: nuevo.componentes ?? anterior?.componentes ?? [],
      acciones: nuevo.acciones ?? anterior?.acciones ?? [],
    }))
    setFilas(agrupar(nuevo.reglas ?? []))
  }

  useEffect(() => {
    const abortar = new AbortController()
    obtenerRetencion(abortar.signal)
      .then(aplicar)
      .catch((err) => { if (!abortar.signal.aborted) setError(mensajeDe(err, 'No se pudo cargar la retención')) })
    return () => abortar.abort()
  }, [])

  const nombre = (formulario: string) => etiquetas[formulario] ?? formulario
  const textoAccion = (accion: string) => (accion === TODAS ? 'Todas las acciones' : accion.replaceAll('_', ' '))

  const cambiar = (id: number, cambios: Partial<Fila>) =>
    setFilas((actuales) => actuales.map((f) => (f.id === id ? { ...f, ...cambios } : f)))

  const agregar = () => setFilas((actuales) => [
    ...actuales,
    { id: siguienteId++, formularios: [componenteActual], accion: TODAS, dias: 90, activo: true },
  ])

  const quitar = (id: number) => setFilas((actuales) => actuales.filter((f) => f.id !== id))

  const reglas = expandir(filas)
  const claves = reglas.map(clave)
  const repetidas = new Set(claves.filter((c, i) => claves.indexOf(c) !== i))
  const filaRepetida = (f: Fila) => f.formularios.some((formulario) => repetidas.has(clave({ formulario, accion: f.accion })))
  const filaVacia = filas.some((f) => f.formularios.length === 0)
  const diasInvalidos = filas.some((f) => !Number.isInteger(f.dias) || f.dias < 1 || f.dias > MAX_DIAS)
  const sinCambios = estado !== null && firma(estado.reglas) === firma(reglas)

  // Registros que se borrarian hoy por fila (solo con las reglas ya guardadas)
  const eliminablesDe = (f: Fila) => {
    if (!estado || !sinCambios) return undefined
    return f.formularios.reduce((s, formulario) =>
      s + (estado.reglas.find((r) => r.formulario === formulario && r.accion === f.accion)?.eliminables ?? 0), 0)
  }

  const motivoGuardar = ocupado ? null
    : filaVacia ? 'Cada regla debe tener al menos un componente.'
      : repetidas.size ? 'Un componente tiene dos reglas para la misma acción.'
        : diasInvalidos ? `Los días deben ser un número entero entre 1 y ${MAX_DIAS}.`
          : sinCambios ? 'No hay cambios por guardar.'
            : null

  const guardar = async () => {
    setError(null)
    setMensaje(null)
    setOcupado(true)
    try {
      aplicar(await guardarRetencion(reglas))
      setMensaje('Retención guardada. Se aplica en la siguiente revisión (cada hora) o con "Eliminar ahora".')
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la retención'))
    } finally {
      setOcupado(false)
    }
  }

  const eliminables = estado?.reglas.reduce((s, r) => s + (r.eliminables ?? 0), 0) ?? 0

  const eliminarAhora = async () => {
    if (!(await confirmar(`¿Eliminar ya ${eliminables} registro(s) de auditoría según las reglas guardadas? No se puede deshacer.`))) return
    setError(null)
    setMensaje(null)
    setOcupado(true)
    try {
      const nuevo = await ejecutarRetencion()
      aplicar(nuevo)
      if (nuevo.resultado?.error) setError(nuevo.resultado.error)
      else setMensaje(`${nuevo.resultado?.eliminados ?? 0} registro(s) eliminado(s)`)
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo eliminar'))
    } finally {
      setOcupado(false)
    }
  }

  const motivoEliminar = ocupado || !estado ? null
    : !sinCambios ? 'Guarda las reglas antes de eliminar.'
      : eliminables === 0 ? 'No hay registros más antiguos que la retención.'
        : null

  return (
    <section className="retencion-auditoria" aria-labelledby="titulo-retencion">
      <h3 id="titulo-retencion" className="subtitulo-modal">Tiempo de eliminación de la auditoría</h3>
      <p className="ayuda">
        Define cuántos días se conserva la auditoría. Una regla puede aplicar a varios componentes a la vez.
        Con <em>Todas las acciones</em> aplica a todo el componente; una regla de una acción concreta (ej. CONSULTAR)
        tiene prioridad sobre la general. Sin regla, la auditoría del componente no se elimina. Se revisa cada hora.
      </p>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      {!estado ? <p role="status">Cargando reglas…</p> : (
        <>
          {filas.length === 0 ? <p className="vacio">No hay reglas: toda la auditoría se conserva.</p> : (
            <div className="tabla-scroll tabla-retencion">
              <table>
                <thead>
                  <tr><th>Componentes</th><th>Acción</th><th>Conservar (días)</th><th>Activa</th><th>Se eliminarían hoy</th><th aria-label="Opciones"></th></tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const cantidad = eliminablesDe(f)
                    return (
                      <tr key={f.id} className={filaRepetida(f) || f.formularios.length === 0 ? 'fila-error' : undefined}>
                        <td className="celda-componentes">
                          <SeleccionMultiple
                            id={`retencion-componentes-${f.id}`}
                            etiqueta="Componentes"
                            opciones={estado.componentes.map((c) => ({ valor: c, texto: nombre(c) }))}
                            seleccion={f.formularios}
                            onCambio={(formularios) => cambiar(f.id, { formularios })}
                            textoTodos="Selecciona…"
                          />
                        </td>
                        <td>
                          <select aria-label="Acción" value={f.accion} onChange={(e) => cambiar(f.id, { accion: e.target.value })}>
                            <option value={TODAS}>{textoAccion(TODAS)}</option>
                            {estado.acciones.map((a) => <option key={a} value={a}>{textoAccion(a)}</option>)}
                          </select>
                        </td>
                        <td>
                          <input aria-label="Días" type="number" min={1} max={MAX_DIAS} step={1} value={f.dias}
                            onChange={(e) => cambiar(f.id, { dias: Number(e.target.value) })} />
                        </td>
                        <td>
                          <input aria-label="Activa" type="checkbox" checked={f.activo} onChange={(e) => cambiar(f.id, { activo: e.target.checked })} />
                        </td>
                        <td>{cantidad === undefined ? <span className="vacio">Guarda para calcular</span> : cantidad}</td>
                        <td className="acciones">
                          <button type="button" className="secundario peligro" onClick={() => quitar(f.id)}>Quitar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="acciones-form retencion-acciones">
            <button type="button" className="secundario" onClick={agregar} disabled={ocupado}>+ Agregar regla</button>
            <button type="button" onClick={guardar} disabled={motivoGuardar !== null || ocupado} title={motivoGuardar ?? undefined}>
              {ocupado ? 'Guardando…' : 'Guardar reglas'}
            </button>
            <button type="button" className="secundario peligro" onClick={eliminarAhora}
              disabled={motivoEliminar !== null || ocupado} title={motivoEliminar ?? 'Elimina ya con las reglas guardadas'}>
              Eliminar ahora
            </button>
          </div>
          {(motivoGuardar || motivoEliminar) && (
            <ul className="motivos-deshabilitado retencion-motivos" role="status">
              {motivoGuardar && <li><strong>Guardar reglas:</strong> {motivoGuardar}</li>}
              {motivoEliminar && <li><strong>Eliminar ahora:</strong> {motivoEliminar}</li>}
            </ul>
          )}
          <p className="ayuda">
            Última revisión: {fecha(estado.ultimaEjecucion)} · Próxima: {fecha(estado.proximaEjecucion)}
            {estado.resultado?.eliminados !== undefined && ` · Última eliminación: ${estado.resultado.eliminados} registro(s)`}
          </p>
        </>
      )}
    </section>
  )
}
