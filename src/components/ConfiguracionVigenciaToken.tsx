import { useEffect, useState, type FormEvent } from 'react'
import { obtenerVigenciaToken, guardarVigenciaToken } from '../api/usuarios.ts'

export default function ConfiguracionVigenciaToken() {
  const [vigencia, setVigencia] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  useEffect(() => {
    const abortar = new AbortController()
    obtenerVigenciaToken(abortar.signal)
      .then(datos => { if (!abortar.signal.aborted) setVigencia(datos.vigencia) })
      .catch(() => { if (!abortar.signal.aborted) setError('No se pudo cargar la vigencia') })
      .finally(() => { if (!abortar.signal.aborted) setCargando(false) })
    return () => abortar.abort()
  }, [])
  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (cargando || guardando) return
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const datos = await guardarVigenciaToken(vigencia.trim())
      setVigencia(datos.vigencia)
      setMensaje('Vigencia guardada. Se aplica a los tokens de los proximos inicios de sesion.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la vigencia') }
    finally { setGuardando(false) }
  }
  return <form onSubmit={guardar}>
    <fieldset disabled={cargando || guardando}>
      <legend>Vigencia global del token</legend>
      <label htmlFor="vigencia-token">Duracion de la sesion</label>
      <input id="vigencia-token" required pattern="[1-9][0-9]*[smhd]" value={vigencia}
        onChange={e => setVigencia(e.target.value)} placeholder="8h" aria-describedby="ayuda-vigencia-token" />
      <p id="ayuda-vigencia-token" className="ayuda">Usa s para segundos, m para minutos, h para horas o d para dias. Por ejemplo, 30m, 8h o 1d. Se aplica a los nuevos tokens de todos los usuarios.</p>
      <button type="submit">{guardando ? 'Guardando...' : 'Guardar vigencia'}</button>
    </fieldset>
    {cargando && <p role="status">Cargando vigencia...</p>}
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}
  </form>
}
