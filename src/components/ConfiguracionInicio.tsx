import { useState } from 'react'
import type { Ruta } from '../api/rutas.ts'
import { ACCESO } from '../rutas/accesos.ts'
import { guardarInicio, useRutaInicio } from '../sitio/inicio.ts'

const AUTOMATICA = ''

// Pagina a la que se va despues de iniciar sesion (coleccion configuracionsitio)
export default function ConfiguracionInicio({ rutas }: { rutas: Ruta[] }) {
  const actual = useRutaInicio()
  const [elegida, setElegida] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Solo rutas privadas, activas y sin parametros (/:id no se puede abrir directamente)
  const opciones = rutas.filter((r) => r.activo && r.accessType?.codigo === ACCESO.PRIVADA && !r.path.includes(':'))
  const primera = opciones[0]
  const valor = elegida ?? actual ?? AUTOMATICA
  // La configurada ya no es valida (se borro, se desactivo o dejo de ser privada)
  const invalida = actual !== null && !opciones.some((r) => r.id === actual)

  const guardar = async () => {
    setError(null)
    setMensaje(null)
    setGuardando(true)
    try {
      await guardarInicio(valor === AUTOMATICA ? null : valor)
      setElegida(null)
      setMensaje('Página de inicio guardada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="config-logo" aria-labelledby="titulo-inicio">
      <h2 id="titulo-inicio">Página después de iniciar sesión</h2>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}
      {invalida && (
        <p className="alerta alerta-error" role="alert">
          La página configurada ya no está activa o no es privada; se usa la automática.
        </p>
      )}

      <div className="form-inicio">
        <div className="campo">
          <label htmlFor="ruta-inicio">Ir a</label>
          <select id="ruta-inicio" value={invalida && elegida === null ? AUTOMATICA : valor}
            onChange={(e) => setElegida(e.target.value)} disabled={guardando}>
            <option value={AUTOMATICA}>
              Automática (primera ruta privada por orden{primera ? `: ${primera.titulo ?? primera.path}` : ''})
            </option>
            {opciones.map((r) => (
              <option key={r.id} value={r.id}>{r.titulo ?? r.componente} · {r.path}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={guardar} disabled={guardando || elegida === null || elegida === (actual ?? AUTOMATICA)}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      <p className="ayuda">
        Si alguien abrió una página protegida sin sesión, después del login vuelve a esa página en lugar de esta.
      </p>
    </section>
  )
}
