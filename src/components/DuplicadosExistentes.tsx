import { useConfirmar } from './useConfirmar.ts'
import { useEffect, useState } from 'react'
import { contarDuplicados, eliminarDuplicados } from '../api/auditoria.ts'

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

// Rechazos repetidos guardados antes de que la sincronizacion filtrara duplicados
// (mismo NIT, factura, destinatario y estado). Se conserva el primer envio de cada grupo.
export default function DuplicadosExistentes() {
  const confirmar = useConfirmar()
  const [conteo, setConteo] = useState<{ grupos: number; duplicados: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    contarDuplicados()
      .then(setConteo)
      .catch((err) => setError(mensajeDe(err, 'No se pudieron contar los duplicados')))
  }, [])

  const eliminar = async () => {
    if (!conteo || !await confirmar(`¿Eliminar ${conteo.duplicados} rechazo(s) duplicado(s)? Se conserva el primer `
      + 'envío de cada factura, destinatario y estado. Esta acción no se puede deshacer.')) {
      return
    }
    setError(null)
    setMensaje(null)
    setOcupado(true)
    try {
      const { eliminados, grupos } = await eliminarDuplicados()
      setMensaje(`${eliminados} duplicado(s) eliminado(s) en ${grupos} grupo(s)`)
      setConteo(await contarDuplicados())
    } catch (err) {
      setError(mensajeDe(err, 'No se pudieron eliminar los duplicados'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section aria-labelledby="titulo-duplicados">
      <h3 id="titulo-duplicados" className="subtitulo-modal">Duplicados ya guardados</h3>
      <p className="ayuda">
        La sincronización ya no guarda duplicados: una misma factura, destinatario y estado se guarda una sola vez
        (el primer envío). Los guardados antes de esta regla se pueden eliminar aquí.
      </p>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      <div className="form-inicio">
        <p className="resumen">
          {conteo === null
            ? 'Contando…'
            : conteo.duplicados === 0
              ? 'No hay duplicados'
              : `${conteo.duplicados} duplicado(s) en ${conteo.grupos} grupo(s) de factura, destinatario y estado`}
        </p>
        <button type="button" className="secundario peligro" onClick={eliminar}
          disabled={ocupado || !conteo || conteo.duplicados === 0}>
          {ocupado ? 'Eliminando…' : 'Eliminar duplicados'}
        </button>
      </div>
    </section>
  )
}
