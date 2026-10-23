import { useRespuestaTiempoReal } from '../components/useRespuestaTiempoReal.ts'
import { useConfirmar } from '../components/useConfirmar.ts'
import { useEffect, useState, type FormEvent } from 'react'
import {
  actualizarRuta,
  crearRuta,
  eliminarRuta,
  moverRuta,
  obtenerAccessTypes,
  obtenerRolesDeRutas,
  obtenerTodasLasRutas,
  type AccessType,
  type DatosRuta,
  type RolDisponible,
  type Ruta,
} from '../api/rutas.ts'
import SeleccionMultiple from '../components/SeleccionMultiple.tsx'
import ConfiguracionApariencia from '../components/ConfiguracionApariencia.tsx'
import ConfiguracionInicio from '../components/ConfiguracionInicio.tsx'
import ConfiguracionLogo from '../components/ConfiguracionLogo.tsx'
import ModalRoles from '../components/ModalRoles.tsx'
import ModalAuditoria from '../components/ModalAuditoria.tsx'
import { ACCESO } from '../rutas/accesos.ts'
import { COMPONENTES_CRITICOS, NOMBRES_COMPONENTES } from '../rutas/componentes.ts'
import { useRutas } from '../rutas/useRutas.ts'

const VACIO: DatosRuta = { path: '/', componente: '', titulo: '', accessType: '', activo: true, roles: [] }

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

// Igual que el backend: '/Facturas/' -> '/facturas'
const normalizarPath = (path: string) => path.trim().toLowerCase().replace(/\/+$/, '') || '/'

// Pantalla para configurar las rutas dinamicas (coleccion rutasseguridad)
export default function ConfiguracionRutas() {
  const confirmar = useConfirmar()
  const { recargar } = useRutas()
  const [mostrarRoles, setMostrarRoles] = useState(false)
  const [mostrarAuditoria, setMostrarAuditoria] = useState(false)
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [accessTypes, setAccessTypes] = useState<AccessType[]>([])
  const [form, setForm] = useState<DatosRuta>(VACIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  useRespuestaTiempoReal<{rutas: Ruta[]}>('/rutas/todas', datos => setRutas(datos.rutas))
  // Roles que se pueden asignar a una ruta para ocultarla a quien no los tenga
  const [rolesDisponibles, setRolesDisponibles] = useState<RolDisponible[]>([])

  useEffect(() => {
    Promise.all([obtenerTodasLasRutas(), obtenerAccessTypes(), obtenerRolesDeRutas()])
      .then(([todas, tipos, roles]) => {
        setRutas(todas)
        setAccessTypes(tipos)
        setRolesDisponibles(roles)
      })
      .catch((err) => setError(mensajeDe(err, 'No se pudo cargar la configuración')))
      .finally(() => setCargando(false))
  }, [])

  // Al cerrar el registro de roles se recarga la lista (puede haber roles nuevos)
  const cerrarRoles = () => {
    setMostrarRoles(false)
    obtenerRolesDeRutas().then(setRolesDisponibles).catch(() => {})
  }

  const nombreRol = (codigo: string) => rolesDisponibles.find((r) => r.codigo === codigo)?.nombre ?? codigo
  // Los roles aplican a rutas publicas y privadas (no a las de solo invitado)
  const codigoAcceso = accessTypes.find((t) => t.id === form.accessType)?.codigo
  const aplicanRoles = codigoAcceso === ACCESO.PRIVADA || codigoAcceso === ACCESO.PUBLICA
  // Casilla "Restringir por roles": desmarcarla quita la restriccion de una ruta que ya tenia roles
  const [restringirRoles, setRestringirRoles] = useState(false)

  // Recarga la tabla y las rutas de la aplicacion para que el cambio aplique de inmediato
  const refrescar = async () => {
    setRutas(await obtenerTodasLasRutas())
    await recargar()
  }

  const cambiar = <K extends keyof DatosRuta>(campo: K, valor: DatosRuta[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  const limpiar = () => {
    setForm(VACIO)
    setEditandoId(null)
    setRestringirRoles(false)
  }

  const editar = (ruta: Ruta) => {
    setForm({
      path: ruta.path,
      componente: ruta.componente,
      titulo: ruta.titulo ?? '',
      accessType: ruta.accessType?.id ?? '',
      activo: ruta.activo,
      roles: ruta.roles ?? [],
    })
    setRestringirRoles((ruta.roles?.length ?? 0) > 0)
    setEditandoId(ruta.id)
    setError(null)
    setMensaje(null)
  }

  // Login y ConfiguracionRutas: quitarlos o restringirlos puede dejar la app sin acceso
  const confirmarSiEsCritica = async (componente: string, accion: string) =>
    !COMPONENTES_CRITICOS.includes(componente)
    || await confirmar(`La ruta del componente ${componente} es necesaria para ${componente === 'Login' ? 'iniciar sesión' : 'volver a configurar las rutas'}. ¿Seguro que quieres ${accion}?`)

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setMensaje(null)

    // Sin duplicados: ni el mismo path ni el mismo componente en otra ruta
    const path = normalizarPath(form.path)
    const otras = rutas.filter((r) => r.id !== editandoId)
    if (otras.some((r) => r.path === path)) {
      setError(`Ya existe una ruta con el path ${path}`)
      return
    }
    if (otras.some((r) => r.componente === form.componente)) {
      setError(`El componente ${form.componente} ya está asignado a otra ruta`)
      return
    }

    if (aplicanRoles && restringirRoles && form.roles.length === 0) {
      setError('Elige al menos un rol o desmarca "Restringir por roles"')
      return
    }

    const tipo = accessTypes.find((t) => t.id === form.accessType)
    const esperado = form.componente === 'Login' ? ACCESO.SOLO_INVITADO : ACCESO.PRIVADA
    const restringe = !form.activo || (COMPONENTES_CRITICOS.includes(form.componente) && tipo?.codigo !== esperado)
    if (restringe && !(await confirmarSiEsCritica(form.componente, 'guardarla así'))) {
      return
    }

    setGuardando(true)
    try {
      // Sin "Restringir por roles" (o en rutas de solo invitado) se guardan sin roles
      const datos = { ...form, path, roles: aplicanRoles && restringirRoles ? form.roles : [] }
      if (editandoId) {
        await actualizarRuta(editandoId, datos)
        setMensaje(`Ruta ${path} actualizada`)
      } else {
        await crearRuta(datos)
        setMensaje(`Ruta ${path} creada`)
      }
      limpiar()
      await refrescar()
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la ruta'))
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (ruta: Ruta) => {
    if (!(await confirmar(`¿Eliminar la ruta ${ruta.path}?${COMPONENTES_CRITICOS.includes(ruta.componente) ? ' Esta ruta es necesaria para acceder a la aplicación o configurar sus rutas.' : ''}`))) {
      return
    }
    setError(null)
    setMensaje(null)
    try {
      await eliminarRuta(ruta.id)
      if (editandoId === ruta.id) {
        limpiar()
      }
      setMensaje(`Ruta ${ruta.path} eliminada`)
      await refrescar()
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo eliminar la ruta'))
    }
  }

  const mover = async (ruta: Ruta, direccion: 'arriba' | 'abajo') => {
    setError(null)
    setMensaje(null)
    setMoviendo(true)
    try {
      setRutas(await moverRuta(ruta.id, direccion))
      await recargar()
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo mover la ruta'))
    } finally {
      setMoviendo(false)
    }
  }

  if (cargando) {
    return <p className="cargando" role="status">Cargando…</p>
  }

  // Componente -> path de la ruta que ya lo usa (para no asignarlo dos veces)
  const usadoPor = new Map(rutas.filter((r) => r.id !== editandoId).map((r) => [r.componente, r.path]))

  // Si la ruta usa un componente que ya no esta registrado, se muestra igual para poder corregirla
  const componentes = form.componente && !NOMBRES_COMPONENTES.includes(form.componente)
    ? [...NOMBRES_COMPONENTES, form.componente]
    : NOMBRES_COMPONENTES

  return (
    <main className="contenido">
      <ConfiguracionLogo />
      <ConfiguracionApariencia />
      <ConfiguracionInicio rutas={rutas} />

      <div className="configuracion-cabecera">
        <h1>Configuración de rutas</h1>
        <div className="acciones-form">
          <button type="button" className="secundario" onClick={() => setMostrarAuditoria(true)}>Ver auditoría</button>
          <button type="button" onClick={() => setMostrarRoles(true)}>Registrar rol</button>
        </div>
      </div>
      {mostrarRoles && <ModalRoles onCerrar={cerrarRoles} />}
      {mostrarAuditoria && <ModalAuditoria onCerrar={() => setMostrarAuditoria(false)} />}

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      <form className="form-rutas" onSubmit={guardar}>
        <div className="campo">
          <label htmlFor="ruta-path">Path</label>
          <input id="ruta-path" value={form.path} onChange={(e) => cambiar('path', e.target.value)} placeholder="/facturas" required />
        </div>
        <div className="campo">
          <label htmlFor="ruta-titulo">Título (menú)</label>
          <input id="ruta-titulo" value={form.titulo} onChange={(e) => cambiar('titulo', e.target.value)} maxLength={60} />
        </div>
        <div className="campo">
          <label htmlFor="ruta-componente">Componente</label>
          <select id="ruta-componente" value={form.componente} onChange={(e) => cambiar('componente', e.target.value)} required>
            <option value="" disabled>Selecciona…</option>
            {componentes.map((nombre) => (
              <option key={nombre} value={nombre} disabled={usadoPor.has(nombre)}>
                {usadoPor.has(nombre) ? `${nombre} (en uso en ${usadoPor.get(nombre)})` : nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ruta-acceso">Tipo de acceso</label>
          <select id="ruta-acceso" value={form.accessType} onChange={(e) => cambiar('accessType', e.target.value)} required>
            <option value="" disabled>Selecciona…</option>
            {accessTypes.map((t) => <option key={t.id} value={t.id} title={t.descripcion ?? undefined}>{t.nombre}</option>)}
          </select>
        </div>
        {aplicanRoles && (
          <label className="campo-check" title="Si la desmarcas, la vista deja de depender de roles">
            <input type="checkbox" checked={restringirRoles} onChange={(e) => setRestringirRoles(e.target.checked)} />
            Restringir por roles
          </label>
        )}
        {aplicanRoles && restringirRoles && (
          <SeleccionMultiple
            id="ruta-roles"
            etiqueta="Roles que pueden ver y ejecutar"
            opciones={rolesDisponibles.map((r) => ({ valor: r.codigo, texto: `${r.nombre} · ${r.codigo}` }))}
            seleccion={form.roles}
            onCambio={(roles) => cambiar('roles', roles)}
            textoTodos="Selecciona…"
          />
        )}
        <label className="campo-check">
          <input type="checkbox" checked={form.activo} onChange={(e) => cambiar('activo', e.target.checked)} />
          Activa
        </label>
        <div className="acciones-form">
          <button type="submit" disabled={guardando || !form.path || !form.componente || !form.accessType}>
            {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear ruta'}
          </button>
          {editandoId && <button type="button" className="secundario" onClick={limpiar}>Cancelar</button>}
        </div>
      </form>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>Componente</th>
              <th>Título</th>
              <th>Acceso</th>
              <th>Roles</th>
              <th>Orden</th>
              <th>Estado</th>
              <th aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {rutas.map((r, i) => (
              <tr key={r.id} className={editandoId === r.id ? 'fila-editando' : undefined}>
                <td><code>{r.path}</code></td>
                <td>
                  {r.componente}
                  {!NOMBRES_COMPONENTES.includes(r.componente) && <span className="estado estado-bounced"> (no registrado)</span>}
                </td>
                <td>{r.titulo}</td>
                <td>{r.accessType?.nombre ?? '—'}</td>
                <td>
                  {r.accessType?.codigo === ACCESO.SOLO_INVITADO ? <span className="vacio">No aplica</span>
                    : r.roles?.length ? r.roles.map(nombreRol).join(', ')
                      : 'Sin restricción'}
                </td>
                <td>
                  <div className="orden">
                    <span>{r.orden}</span>
                    <button type="button" className="secundario" onClick={() => mover(r, 'arriba')}
                      disabled={moviendo || i === 0} aria-label={`Subir ${r.path}`} title="Subir">▲</button>
                    <button type="button" className="secundario" onClick={() => mover(r, 'abajo')}
                      disabled={moviendo || i === rutas.length - 1} aria-label={`Bajar ${r.path}`} title="Bajar">▼</button>
                  </div>
                </td>
                <td>{r.activo ? 'Activa' : <span className="estado estado-deferred">Inactiva</span>}</td>
                <td className="acciones">
                  <button type="button" className="secundario" onClick={() => editar(r)}>Editar</button>
                  <button type="button" className="secundario peligro" onClick={() => borrar(r)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
