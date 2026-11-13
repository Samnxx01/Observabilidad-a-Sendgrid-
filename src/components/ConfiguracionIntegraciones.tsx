import { useEffect, useState, type FormEvent } from 'react'
import { obtenerIntegraciones, guardarIntegraciones, type Integraciones } from '../api/servicios.ts'

export default function ConfiguracionIntegraciones({ onGuardado }: { onGuardado: () => void }) {
  const [datos, setDatos] = useState<Integraciones | null>(null)
  const [sendgridApiKey, setSendgridApiKey] = useState('')
  const [newrelicApiKey, setNewrelicApiKey] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    let activo = true
    obtenerIntegraciones().then(valor => { if (activo) setDatos(valor) })
      .catch(() => { if (activo) setError('No se pudo cargar la configuracion') })
    return () => { activo = false }
  }, [])
  const guardar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (!datos || guardando) return
    setGuardando(true)
    setError(null)
    setAviso('')
    try {
      setDatos(await guardarIntegraciones({ ...datos, sendgridApiKey, newrelicApiKey }))
      setSendgridApiKey('')
      setNewrelicApiKey('')
      setAviso('Configuracion guardada y aplicada en el backend.')
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally { setGuardando(false) }
  }
  return <details>
    <summary className="boton-secundario">Configurar SendGrid y New Relic</summary>
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {aviso && <p className="alerta alerta-info" role="status">{aviso}</p>}
    {datos && <form className="busqueda" onSubmit={guardar}>
      <fieldset disabled={guardando}>
        <legend>Credenciales de servicios</legend>
        <p className="ayuda">Deja las API keys vacias para conservar las claves guardadas.</p>
        <div className="campo">
          <label htmlFor="integracion-sendgrid">API key de SendGrid</label>
          <input id="integracion-sendgrid" type="password" autoComplete="new-password" maxLength={500}
            value={sendgridApiKey} onChange={e => setSendgridApiKey(e.target.value)}
            placeholder={datos.sendgridConfigurado ? 'Clave configurada' : 'Introduce la API key'} />
        </div>
        <div className="campo">
          <label htmlFor="integracion-newrelic">API key de New Relic</label>
          <input id="integracion-newrelic" type="password" autoComplete="new-password" maxLength={500}
            value={newrelicApiKey} onChange={e => setNewrelicApiKey(e.target.value)}
            placeholder={datos.newrelicConfigurado ? 'Clave configurada' : 'License key o Insert key'} />
        </div>
        <div className="campo">
          <label htmlFor="integracion-keyid">Key ID de New Relic</label>
          <input id="integracion-keyid" maxLength={100} value={datos.keyId} onChange={e => setDatos({ ...datos, keyId: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="integracion-account">Account ID de New Relic</label>
          <input id="integracion-account" inputMode="numeric" pattern="[0-9]*" maxLength={30} value={datos.account} onChange={e => setDatos({ ...datos, account: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="integracion-region">Region de New Relic</label>
          <select id="integracion-region" value={datos.region} onChange={e => setDatos({ ...datos, region: e.target.value as 'US' | 'EU' })}>
            <option value="US">US</option><option value="EU">EU</option>
          </select>
        </div>
        <label><input type="checkbox" checked={datos.enabled} onChange={e => setDatos({ ...datos, enabled: e.target.checked })} /> Activar New Relic</label>
        <div className="acciones-form"><button type="submit">{guardando ? 'Guardando...' : 'Guardar configuracion'}</button></div>
      </fieldset>
    </form>}
  </details>
}
