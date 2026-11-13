import ConfiguracionVigenciaToken from './ConfiguracionVigenciaToken.tsx'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { guardarUsuario, obtenerUsuarios, obtenerRolesParaUsuarios, type UsuarioAdministrable } from '../api/usuarios.ts'
import CampoContrasena from './CampoContrasena.tsx'
import { useConfirmar } from './useConfirmar.ts'
import { useAuth } from '../auth/useAuth.ts'
import type { Rol } from '../api/roles.ts'

export default function ModalUsuarios({ onCerrar }: { onCerrar: () => void }) {
  const { usuario: sesion, cerrarSesion } = useAuth()
  const confirmar = useConfirmar()
  const [verVigencia, setVerVigencia] = useState(false)
  const [mostrarAyuda, setMostrarAyuda] = useState(false)
  const [rolesContrasena, setRolesContrasena] = useState<string[]>([])
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const cambiarContrasena = nuevaContrasena.length > 0 || confirmacion.length > 0
  const dialogo = useRef<HTMLDialogElement>(null)
  const [usuarios, setUsuarios] = useState<UsuarioAdministrable[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [editando, setEditando] = useState<UsuarioAdministrable | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  useEffect(() => {
    const anterior = document.activeElement
    const abortar = new AbortController()
    dialogo.current?.showModal()
    Promise.all([obtenerUsuarios(abortar.signal), obtenerRolesParaUsuarios(abortar.signal)])
      .then(([lista, catalogo]) => {
        if (abortar.signal.aborted) return
        setUsuarios(lista)
        setRoles(catalogo)
      })
      .catch((err: unknown) => { if (!abortar.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios') })
      .finally(() => { if (!abortar.signal.aborted) setCargando(false) })
    return () => {
      abortar.abort()
      if (anterior instanceof HTMLElement) anterior.focus()
    }
  }, [])
  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!editando || guardando) return
    if (cambiarContrasena && (nuevaContrasena.length < 8 || new TextEncoder().encode(nuevaContrasena).length > 72)) {
      setError('La nueva contrasena debe tener al menos 8 caracteres y no superar 72 bytes.')
      return
    }
    if (cambiarContrasena && nuevaContrasena !== confirmacion) {
      setError('Las contrasenas no coinciden.')
      return
    }
    if (rolesContrasena.length && !cambiarContrasena) {
      setError('Escriba la nueva contrasena para aplicar el cambio por rol.')
      return
    }
    if (cambiarContrasena && rolesContrasena.length && !await confirmar(
      `La nueva contrasena se aplicara a ${editando.correo} y a todos los usuarios de: ${roles.filter(r => rolesContrasena.includes(r.id)).map(r => r.nombre).join(', ')}. Se invalidaran sus sesiones anteriores. Continuar?`)) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const actualizado = await guardarUsuario(editando, cambiarContrasena ? nuevaContrasena : undefined, cambiarContrasena ? rolesContrasena : [])
      setUsuarios(actuales => actuales.map(u => u.id === actualizado.id ? actualizado : u))
      setNuevaContrasena('')
      setConfirmacion('')
      if (cambiarContrasena && (editando.id === sesion?.id || sesion?.roles?.some(id => rolesContrasena.includes(id)))) {
        await cerrarSesion()
        return
      }
      setEditando(null)
      setRolesContrasena([])
      setMensaje(cambiarContrasena ? rolesContrasena.length ? 'Usuario actualizado y contrasena cambiada para todos los usuarios de los roles marcados.' : `Usuario ${actualizado.correo} y contrasena actualizados.` : `Usuario ${actualizado.correo} actualizado.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario')
    } finally { setGuardando(false) }
  }
  return (
    <dialog ref={dialogo} className="modal modal-roles" aria-labelledby="titulo-usuarios" onClose={onCerrar}
      onCancel={evento => { if (guardando) evento.preventDefault() }}>
      <div className="modal-cabecera">
        <h2 id="titulo-usuarios">Administrar usuarios</h2>
        <button type="button" className="secundario" aria-expanded={verVigencia}
          onClick={() => setVerVigencia(actual => !actual)}>Vigencia del token</button>
        <button type="button" className="secundario" disabled={guardando} onClick={() => dialogo.current?.close()}>Cerrar</button>
      </div>
      {verVigencia && <ConfiguracionVigenciaToken />}
      <p className="ayuda">Verifica las cuentas y asigna los roles que conceden permisos. Las cuentas nuevas requieren verificacion para iniciar sesion.</p>
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}
      {cargando ? <p role="status">Cargando usuarios...</p> : <>
        <label htmlFor="buscar-usuario">Buscar por correo</label>
        <input id="buscar-usuario" type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Correo</th><th>Estado</th><th>Roles</th><th>Acciones</th></tr></thead>
            <tbody>{usuarios.filter(u => u.correo.toLowerCase().includes(busqueda.trim().toLowerCase())).map(u => (
              <tr key={u.id} className={editando?.id === u.id ? 'fila-editando' : undefined}>
                <td>{u.correo}</td><td>{u.verificado ? 'Verificado' : 'Pendiente de verificacion'}</td>
                <td>{u.roles.map(codigo => roles.find(r => r.id === codigo)?.nombre ?? codigo).join(', ') || 'Sin roles'}</td>
                <td><button type="button" className="secundario" disabled={guardando} onClick={() => { setRolesContrasena([]); setMostrarAyuda(false); setNuevaContrasena(''); setConfirmacion(''); setEditando({ ...u, roles: [...u.roles] }); setError(null); setMensaje(null) }}
                  aria-label={`Editar usuario ${u.correo}`}>Editar</button></td>
              </tr>
            ))}</tbody>
          </table>
          {usuarios.filter(u => u.correo.toLowerCase().includes(busqueda.trim().toLowerCase())).length === 0 && <p>No se encontraron usuarios.</p>}
        </div>
        {editando && <form onSubmit={guardar}>
          <h3>{editando.correo}</h3>
          <fieldset disabled={guardando} className="rol-formulario">
            <label className="campo-check"><input type="checkbox" checked={editando.verificado}
              onChange={e => setEditando({ ...editando, verificado: e.target.checked })} />Usuario verificado</label>
            <fieldset className="rol-permisos"><legend>Roles del usuario</legend>
              {roles.length === 0 && <p>Registra primero un rol en la configuracion.</p>}
              {roles.map(rol => <label key={rol.codigo} className="campo-check">
                <input type="checkbox" checked={editando.roles.includes(rol.id)}
                  onChange={e => { setEditando({ ...editando, roles: e.target.checked ? [...editando.roles, rol.id] : editando.roles.filter(r => r !== rol.id) }); if (!e.target.checked) setRolesContrasena(actuales => actuales.filter(id => id !== rol.id)) }} />
                {rol.nombre} ({rol.codigo})
              </label>)}
            </fieldset>
            {editando.roles.length === 0 && <p className="ayuda">Sin roles, el usuario no tendra permisos para ejecutar acciones.</p>}
            <fieldset className="rol-permisos">
              <legend>Cambio de contraseña (opcional)</legend>
              <button type="button" className="secundario" aria-expanded={mostrarAyuda} aria-controls="ayuda-contrasena"
                onClick={() => setMostrarAyuda(actual => !actual)}>Ayuda: usuario o rol</button>
              {mostrarAyuda && <div id="ayuda-contrasena" className="alerta alerta-info">
                <p><strong>Sin roles marcados abajo:</strong> la nueva contraseña se aplica solamente a {editando.correo}.</p>
                <p><strong>Con un rol marcado abajo:</strong> la misma nueva contraseña se aplica al usuario editado y a todos los usuarios que tengan cualquiera de los roles marcados.</p>
                <p>Estas casillas definen el alcance del cambio de contraseña. Las casillas de Roles del usuario, arriba, asignan sus permisos.</p>
                <p>Deje ambos campos vacios para conservar las contraseñas. Al cambiar una clave se invalidan las sesiones anteriores de los usuarios afectados.</p>
              </div>}
              <label htmlFor="usuario-nueva-contrasena">Nueva contraseña</label>
              <CampoContrasena id="usuario-nueva-contrasena" autoComplete="new-password" minLength={8}
                value={nuevaContrasena} onChange={e => setNuevaContrasena(e.target.value)} />
              <label htmlFor="usuario-confirmar-contrasena">Confirmar contraseña</label>
              <CampoContrasena id="usuario-confirmar-contrasena" autoComplete="new-password" minLength={8} required={cambiarContrasena}
                value={confirmacion} onChange={e => setConfirmacion(e.target.value)} />
              <fieldset className="rol-permisos">
                <legend>Aplicar tambien a todos los usuarios del rol</legend>
                {roles.filter(rol => editando.roles.includes(rol.id)).map(rol => <label key={rol.id} className="campo-check">
                  <input type="checkbox" checked={rolesContrasena.includes(rol.id)}
                    onChange={e => setRolesContrasena(actuales => e.target.checked ? [...actuales, rol.id] : actuales.filter(id => id !== rol.id))} />
                  {rol.nombre}
                </label>)}
                {editando.roles.length === 0 && <p className="ayuda">Este usuario no tiene roles. El cambio se aplica solo a su cuenta.</p>}
              </fieldset>
              <p className="ayuda" role="status">{rolesContrasena.length
                ? `Alcance general: ${editando.correo} y todos los usuarios de ${roles.filter(rol => rolesContrasena.includes(rol.id)).map(rol => rol.nombre).join(', ')}.`
                : `Alcance individual: solo ${editando.correo}.`}</p>
            </fieldset>
            <div className="rol-pie">
              <button type="button" className="secundario" onClick={() => { setEditando(null); setNuevaContrasena(''); setConfirmacion(''); setRolesContrasena([]) }}>Cancelar</button>
              <button type="submit">{guardando ? 'Guardando...' : 'Guardar usuario'}</button>
            </div>
          </fieldset>
        </form>}
      </>}
    </dialog>
  )
}
