import SelectorColor from './SelectorColor.tsx'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/cliente.ts'
import { aplicarTema, CAMPOS_TEMA, type Tema } from '../sitio/tema.ts'
export default function ConfiguracionApariencia() {
  const [tema, setTema] = useState<Partial<Tema>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const abortar = new AbortController()
    api<{tema: Tema | null}>('/configuracion/tema', { signal: abortar.signal, notificar: false })
      .then(r => { if (!abortar.signal.aborted) setTema(r.tema ?? {}) })
      .catch((err: unknown) => { if (!abortar.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo cargar la apariencia') })
      .finally(() => { if (!abortar.signal.aborted) setCargando(false) })
    return () => abortar.abort()
  }, [])
  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault(); setGuardando(true); setError(null)
    try { const r = await api<{tema: Tema}>('/configuracion/tema', { method: 'PUT', body: JSON.stringify({tema}) }); aplicarTema(r.tema) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
    finally { setGuardando(false) }
  }
  return <section className="config-logo">
    <h2>Apariencia de la aplicación</h2>
    <p className="ayuda">Pulsa cada muestra para seleccionar un color o escribe su código hexadecimal. Los cambios se aplican al guardar.</p>
    {error && <p className="alerta alerta-error" role="alert">{error}</p>}
    {cargando ? <p role="status">Cargando apariencia...</p> : <form onSubmit={guardar}>
      <fieldset className="tema-campos" disabled={guardando}>
        {Object.entries(CAMPOS_TEMA).map(([campo, [etiqueta]]) => <div className="campo" key={campo}>
          <label htmlFor={'tema-' + campo}>{etiqueta}</label>
          <div className="tema-color">
            <SelectorColor etiqueta={etiqueta} valor={tema[campo as keyof Tema] ?? ''} deshabilitado={guardando}
              onCambio={color => setTema(actual => ({ ...actual, [campo]: color }))} />
            <input id={'tema-' + campo} required pattern="#[0-9A-Fa-f]{6}" placeholder="#RRGGBB" maxLength={7}
              value={tema[campo as keyof Tema] ?? ''} onChange={e => setTema(actual => ({...actual, [campo]: e.target.value}))} />
          </div>
        </div>)}
      </fieldset>
      <button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar apariencia'}</button>
    </form>}
  </section>
}
