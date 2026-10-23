import { useRespuestaTiempoReal } from './useRespuestaTiempoReal.ts'
import { useConfirmar } from './useConfirmar.ts'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { guardarRol, obtenerAcciones, obtenerRoles, type Rol } from '../api/roles.ts'

const ETIQUETAS: Record<string, string> = {
  'usuarios.administrar': 'Administrar usuarios',
  'roles.administrar': 'Administrar roles',
  'rutas.administrar': 'Administrar rutas',
  'configuracion.administrar': 'Administrar configuración del sitio',
  'facturas.consultar': 'Consultar facturas',
  'auditoria.consultar': 'Consultar eventos de rechazos',
  'auditoria.exportar': 'Exportar eventos de rechazos',
  'auditoria.sincronizar': 'Sincronizar auditoría',
  'bases.administrar': 'Administrar bases de auditoría',
  'watcher.administrar': 'Administrar programación de sincronización',
  'limpieza.administrar': 'Administrar limpieza de registros',
  'newrelic.enviar': 'Enviar eventos a New Relic',
}

export default function ModalRoles({ onCerrar }: { onCerrar: () => void }) {
  const confirmar = useConfirmar()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  useRespuestaTiempoReal<{roles: Rol[]}>('/roles', datos => setRoles(datos.roles))
  const [acciones, setAcciones] = useState<string[]>([])
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  // Codigo del rol que se esta editando (null = registrando uno nuevo)
  const [editando, setEditando] = useState<string | null>(null)
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const modal = dialogo.current
    const anterior = document.activeElement
    const abortar = new AbortController()
    if (modal && !modal.open) modal.showModal()
    Promise.all([obtenerRoles(abortar.signal), obtenerAcciones(abortar.signal)])
      .then(([registrados, catalogo]) => {
        if (abortar.signal.aborted) return
        setRoles(registrados)
        setAcciones(catalogo)
      })
      .catch((err: unknown) => {
        if (!abortar.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudieron cargar los roles')
      })
      .finally(() => { if (!abortar.signal.aborted) setCargando(false) })
    return () => {
      abortar.abort()
      if (anterior instanceof HTMLElement) anterior.focus()
    }
  }, [])

  const limpiar = () => {
    setCodigo('')
    setNombre('')
    setSeleccionadas([])
    setEditando(null)
  }

  // Carga el rol en el formulario; el codigo no se cambia porque identifica al rol
  const editar = (rol: Rol) => {
    setCodigo(rol.codigo)
    setNombre(rol.nombre)
    setSeleccionadas(rol.acciones.filter(accion => acciones.includes(accion)))
    setEditando(rol.codigo)
    setError(null)
    setMensaje(null)
    formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (guardando || cargando) return
    setError(null)
    setMensaje(null)
    if (!editando && roles.some(rol => rol.codigo === codigo)) {
      setError('Ya existe un rol con ese código. Usa un código diferente o edítalo desde la tabla.')
      return
    }
    if (!nombre.trim()) {
      setError('Escribe el nombre del rol.')
      return
    }
    // Quitarle a un rol la administracion de roles o usuarios puede dejar a todos sin acceso a esta pantalla
    const anterior = roles.find(rol => rol.codigo === editando)
    const quitaCriticas = anterior?.acciones.filter(accion =>
      ['roles.administrar', 'usuarios.administrar'].includes(accion) && !seleccionadas.includes(accion)) ?? []
    if (quitaCriticas.length > 0 && !await confirmar(
      `Vas a quitarle a ${anterior?.codigo} "${quitaCriticas.map(a => ETIQUETAS[a] ?? a).join('" y "')}". `
      + 'Si nadie más tiene esa acción, nadie podrá volver a administrar roles o usuarios. ¿Continuar?')) {
      return
    }
    setGuardando(true)
    try {
      const rol = await guardarRol({ codigo, nombre: nombre.trim(), acciones: seleccionadas })
      setRoles(actuales => [...actuales.filter(r => r.codigo !== rol.codigo), rol]
        .sort((a, b) => a.codigo.localeCompare(b.codigo)))
      setMensaje(editando ? `Rol ${rol.nombre} actualizado correctamente.` : `Rol ${rol.nombre} registrado correctamente.`)
      limpiar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el rol')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <dialog ref={dialogo} className="modal modal-roles" aria-labelledby="titulo-roles"
      aria-describedby="descripcion-roles" onClose={onCerrar}
      onCancel={evento => { if (guardando) evento.preventDefault() }}>
      <div className="modal-cabecera">
        <h2 id="titulo-roles">Registro de roles</h2>
        <button type="button" className="secundario" disabled={guardando} onClick={() => dialogo.current?.close()}>Cerrar</button>
      </div>
      <p id="descripcion-roles" className="ayuda">Define un rol y selecciona las acciones que podrá realizar.</p>
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}
      {cargando ? <p role="status">Cargando roles y acciones…</p> : (
        <form ref={formulario} onSubmit={guardar}>
          {editando && <p className="alerta alerta-info" role="status">Editando el rol <strong>{editando}</strong>. El código no se puede cambiar.</p>}
          <fieldset className="rol-formulario" disabled={guardando || acciones.length === 0}>
            <div className="rol-datos">
              <div className="campo">
                <label htmlFor="rol-codigo">Código</label>
                <input id="rol-codigo" value={codigo} maxLength={40} pattern="[A-Z][A-Z0-9_]{1,39}" required
                  readOnly={editando !== null}
                  aria-describedby="rol-codigo-ayuda" placeholder="OPERADOR"
                  onChange={evento => setCodigo(evento.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} />
                <small id="rol-codigo-ayuda" className="ayuda">De 2 a 40 caracteres. Empieza con una letra; usa letras, números o guion bajo.</small>
              </div>
              <div className="campo">
                <label htmlFor="rol-nombre">Nombre</label>
                <input id="rol-nombre" value={nombre} maxLength={80} required placeholder="Operador"
                  onChange={evento => setNombre(evento.target.value)} />
              </div>
            </div>
            <fieldset className="rol-permisos">
              <legend>Acciones permitidas ({seleccionadas.length})</legend>
              <p className="ayuda">Sin acciones seleccionadas, el rol no concede permisos.</p>
              <div className="rol-acciones">
                {acciones.map(accion => (
                  <label key={accion} className="campo-check">
                    <input type="checkbox" checked={seleccionadas.includes(accion)}
                      onChange={evento => setSeleccionadas(actuales => evento.target.checked
                        ? [...actuales, accion] : actuales.filter(item => item !== accion))} />
                    {ETIQUETAS[accion] ?? accion}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="rol-pie">
              {editando
                ? <button type="button" className="secundario" onClick={limpiar}>Cancelar edición</button>
                : <button type="button" className="secundario" onClick={() => dialogo.current?.close()}>Cancelar</button>}
              <button type="submit" disabled={!codigo || !nombre.trim()}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar rol'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!cargando && roles.length > 0 && (
        <section className="rol-registrados" aria-labelledby="roles-registrados">
          <h3 id="roles-registrados">Roles registrados</h3>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Código</th><th>Nombre</th><th>Acciones</th><th aria-label="Opciones"></th></tr></thead>
              <tbody>{roles.map(rol => (
                <tr key={rol.codigo} className={editando === rol.codigo ? 'fila-editando' : undefined}>
                  <td>{rol.codigo}</td>
                  <td>{rol.nombre}</td>
                  <td title={rol.acciones.map(a => ETIQUETAS[a] ?? a).join('\n')}>{rol.acciones.length}</td>
                  <td className="acciones">
                    <button type="button" className="secundario" disabled={guardando} onClick={() => editar(rol)}
                      aria-label={`Editar rol ${rol.codigo}`}>Editar</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </dialog>
  )
}
