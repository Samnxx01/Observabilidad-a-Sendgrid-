import { useEffect, useState, type FormEvent } from 'react'
import { listarIpsSendgrid, agregarIpSendgrid, actualizarIpSendgrid, eliminarIpSendgrid, type IpSendgrid } from '../api/sendgridIps.ts'
import { useConfirmar } from '../components/useConfirmar.ts'
import { useAuth } from '../auth/useAuth.ts'

export default function AccesoIpSendgrid() {
  const { usuario } = useAuth()
  const confirmar = useConfirmar()
  const [editando, setEditando] = useState<number | null>(null)
  const permitido = usuario?.acciones?.includes('sendgrid.ips.administrar')
  const [ips, setIps] = useState<IpSendgrid[] | null>(null)
  const [ip, setIp] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!permitido) return
    const control = new AbortController()
    listarIpsSendgrid(control.signal).then(datos => {
      if (!control.signal.aborted) setIps(datos.ips)
    }).catch((err: unknown) => {
      if (!control.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo consultar.')
    }).finally(() => { if (!control.signal.aborted) setCargando(false) })
    return () => control.abort()
  }, [permitido, version])
  const actualizar = () => { setError(''); setCargando(true); setVersion(v => v + 1) }
  const guardar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (guardando) return
    setGuardando(true); setError(''); setAviso('')
    try {
      if (editando !== null) {
        if (!await confirmar('El cambio retirara el acceso de la IP anterior. ¿Continuar?')) return
        await actualizarIpSendgrid(editando, ip.trim())
      } else await agregarIpSendgrid(ip.trim())
      setEditando(null)
      setIp('')
      setAviso(editando !== null ? 'IP actualizada.' : 'IP autorizada.')
      actualizar()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo autorizar la IP.') }
    finally { setGuardando(false) }
  }
  const eliminar = async (item: IpSendgrid) => {
    if (guardando || !await confirmar(`¿Retirar el acceso de ${item.ip}? Si corresponde al backend, las consultas a SendGrid dejaran de funcionar.`)) return
    setGuardando(true); setError(''); setAviso('')
    try {
      await eliminarIpSendgrid(item.id)
      if (editando === item.id) { setEditando(null); setIp('') }
      setAviso('IP eliminada.')
      actualizar()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo eliminar.') }
    finally { setGuardando(false) }
  }
  return <main className="contenido">
    <div className="configuracion-cabecera"><h1>Acceso IP de SendGrid</h1>
      {permitido && <button type="button" disabled={cargando || guardando} onClick={actualizar}>Actualizar lista</button>}
    </div>
    {!permitido ? <p role="alert">Tu rol necesita el permiso Administrar IP de SendGrid.</p> : <>
      <p>Consulta las direcciones autorizadas para acceder a tu cuenta de SendGrid y agrega una IP de salida.</p>
      <p className="alerta alerta-info">Si SendGrid ya bloquea este backend, un administrador debe autorizar su IP primero desde SendGrid o desde un servidor autorizado. La API key necesita permisos de IP Access Management.</p>
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {aviso && <p className="alerta alerta-info" role="status">{aviso}</p>}
      <form className="busqueda" onSubmit={guardar}>
        <fieldset disabled={guardando || cargando}><legend>{editando !== null ? 'Editar direccion' : 'Autorizar una direccion'}</legend>
          <div className="campo"><label htmlFor="sendgrid-ip">IP publica de salida</label>
            <input id="sendgrid-ip" required maxLength={15} placeholder="Ejemplo: 203.0.113.10"
              value={ip} onChange={e => setIp(e.target.value)} aria-describedby="sendgrid-ip-ayuda"
              pattern="([0-9]{1,3}\.){3}[0-9]{1,3}" />
          </div>
          <p id="sendgrid-ip-ayuda" className="ayuda">Ingresa una IPv4 individual. Para habilitar las consultas, usa la IP publica del equipo o servidor donde funciona el backend.</p>
          <button type="submit">{guardando ? 'Guardando...' : editando !== null ? 'Guardar cambio' : 'Autorizar IP'}</button>
        <button type="button" onClick={() => { setEditando(null); setIp('') }}>Cancelar</button></fieldset>
      </form>
      {cargando && <p role="status">Consultando direcciones autorizadas...</p>}
      {ips !== null && <section aria-label="IP autorizadas"><h2>Direcciones autorizadas</h2>
        {ips.length === 0 ? <p>No hay direcciones registradas.</p> : <table><thead><tr><th>ID</th><th>IP autorizada</th><th>Acciones</th></tr></thead><tbody>{ips.map(item =>
          <tr key={item.id}><td>{item.id}</td><td><code>{item.ip}</code></td>
<td><button type="button" disabled={guardando || cargando} onClick={() => { setEditando(item.id); setIp(item.ip); setError(''); setAviso('') }}>Editar</button>
<button type="button" disabled={guardando || cargando} onClick={() => void eliminar(item)}>Eliminar</button></td></tr>)}</tbody></table>}
      </section>}
    </>}
  </main>
}