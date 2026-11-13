import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/cliente.ts'
import MenuExportar from './MenuExportar.tsx'
import { notificar } from '../utils/toast.ts'
import { useConfirmar } from './useConfirmar.ts'
import { describirEstadoSendgrid } from '../utils/estados.ts'
import { exportarArchivo, type Columna, type Formato } from '../utils/exportar.ts'

interface Factura {
  nit: string
  empresa: string
  factura: string | null
  id: string | number
  enviado: boolean
  fechaCreacion: string
  fechaEnvio: string | null
  estadoSendgrid: string | null
  motivo: string | null
  fechaSendgrid: string | null
  sgMessageId: string | null
  // Como se encontro el envio en SendGrid: por numero de factura (asunto) o por hora (dropped sin asunto)
  cruce: 'factura' | 'hora' | null
}

interface RespuestaFacturas {
  email: string
  facturas: Factura[]
  desfaseMinutos: number
  errores: { nit: string; baseDatos: string; error: string }[]
  truncadas: string[]
  incompletoSendgrid?: boolean
  basesConsultadas: number
}

// Seguimiento de un reenvio (coleccion reenviosnotificacion; lo avanza el watcher de reenvios)
interface Reenvio {
  _id: string
  nit: string
  empresa?: string
  factura?: string | null
  notificacionId: number
  estado: 'PENDIENTE' | 'REENVIADA' | 'ENTREGADA' | 'NO_ENTREGADA' | 'SIN_CONFIRMAR'
  usuario?: string
  marcadoEn: string
  fechaReenvio?: string | null
  estadoSendgrid?: string | null
  motivo?: string | null
  ultimaRevision?: string | null
}

const TEXTO_REENVIO: Record<Reenvio['estado'], string> = {
  PENDIENTE: 'Esperando que facturación la reenvíe',
  REENVIADA: 'Reenviada; esperando resultado en SendGrid',
  ENTREGADA: 'Entregada',
  NO_ENTREGADA: 'No entregada',
  SIN_CONFIRMAR: 'Sin confirmar',
}
const CLASE_REENVIO: Record<Reenvio['estado'], string> = {
  PENDIENTE: 'estado-deferred',
  REENVIADA: 'estado-processed',
  ENTREGADA: 'estado-delivered',
  NO_ENTREGADA: 'estado-bounced',
  SIN_CONFIRMAR: 'estado-blocked',
}
const ABIERTOS = ['PENDIENTE', 'REENVIADA']
// Mientras haya reenvios abiertos, el seguimiento se refresca cada minuto
const REFRESCO_MS = 60 * 1000

const clave = (f: { nit: string; id: string | number }) => `${f.nit}-${f.id}`

// Estados de SendGrid en que la factura no llego al buzon
const NO_ENTREGADA = ['dropped', 'bounced', 'blocked']
const POR_PAGINA = 50

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })
const fecha = (iso?: string | null) => (iso ? formatoFecha.format(new Date(iso)) : '')
const formatoDia = (dia: string) => dia.split('-').reverse().join('/')

// Resultado para la persona que va a reenviar
const situacion = (f: Factura) => {
  if (!f.enviado) return 'Facturación aún no la envía'
  if (!f.estadoSendgrid) return 'Sin registro en SendGrid'
  if (NO_ENTREGADA.includes(f.estadoSendgrid)) return 'No entregada: reenviar'
  if (f.estadoSendgrid === 'deferred') return 'Demorada: SendGrid reintenta'
  return 'Entregada'
}

const COLUMNAS_EXPORTAR: Columna<Factura>[] = [
  { titulo: 'Empresa', valor: (f) => f.empresa, ancho: 28 },
  { titulo: 'NIT', valor: (f) => f.nit, ancho: 12 },
  { titulo: 'Factura', valor: (f) => f.factura, ancho: 14 },
  { titulo: 'Envío facturación', valor: (f) => fecha(f.fechaEnvio), ancho: 16 },
  { titulo: 'Estado SendGrid', valor: (f) => f.estadoSendgrid, ancho: 12 },
  { titulo: 'Situación', valor: situacion, ancho: 24 },
  { titulo: 'Cruce', valor: (f) => f.cruce, ancho: 8 },
  { titulo: 'Motivo', valor: (f) => f.motivo, ancho: 40 },
  { titulo: 'Message ID', valor: (f) => f.sgMessageId, ancho: 45 },
]

interface Props {
  email: string
  desde: string
  hasta: string
}

// Facturas notificadas a un correo (dbo.spNotificacionesPorCorreo en cada base) y como terminaron en
// SendGrid (via /api/dropped/facturas-afectadas). Lista las que hay que reenviar desde facturacion.
export default function FacturasAfectadas({ email, desde, hasta }: Props) {
  const [resultado, setResultado] = useState<RespuestaFacturas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [soloNoEntregadas, setSoloNoEntregadas] = useState(true)
  const [pagina, setPagina] = useState(1)
  const confirmar = useConfirmar()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [reenviando, setReenviando] = useState(false)
  const [reenvios, setReenvios] = useState<Reenvio[]>([])

  const cargarReenvios = useCallback(async () => {
    try {
      const { reenvios: lista } = await api<{ reenvios: Reenvio[] }>(`/dropped/reenvios?email=${encodeURIComponent(email)}`)
      setReenvios(lista)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el seguimiento de reenvíos')
    }
  }, [email])

  useEffect(() => { void cargarReenvios() }, [cargarReenvios])

  // Refresco automatico mientras el watcher tenga reenvios abiertos
  const hayAbiertos = reenvios.some((r) => ABIERTOS.includes(r.estado))
  useEffect(() => {
    if (!hayAbiertos) return
    const intervalo = setInterval(() => { void cargarReenvios() }, REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [hayAbiertos, cargarReenvios])

  const marcar = (claves: string[], marcado: boolean) => {
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      claves.forEach((c) => (marcado ? nueva.add(c) : nueva.delete(c)))
      return nueva
    })
  }

  // Deja Status = 0 en facturacion para que las reenvie; el watcher sigue el resultado
  const reenviar = async () => {
    const elegidas = (resultado?.facturas ?? []).filter((f) => seleccion.has(clave(f)))
    const ok = await confirmar(
      `¿Marcar ${elegidas.length} factura(s) para reenvío a ${email}? Se cambia su notificación a Status 0 en la base `
      + 'de facturación (aunque ya esté enviada) para que el sistema la vuelva a enviar. El seguimiento se ve abajo.',
    )
    if (!ok) return
    setError(null)
    setReenviando(true)
    try {
      const r = await api<{ marcadas: number; noEncontradas: unknown[]; errores: { baseDatos: string; error: string }[] }>(
        '/dropped/reenviar',
        { method: 'POST', body: JSON.stringify({ email, facturas: elegidas.map((f) => ({ nit: f.nit, id: f.id, factura: f.factura })) }) },
      )
      setSeleccion(new Set())
      notificar(`${r.marcadas} factura(s) marcadas para reenvío`
        + (r.noEncontradas.length ? ` · ${r.noEncontradas.length} no encontrada(s)` : ''))
      if (r.errores.length) {
        setError(`No se pudo marcar en: ${r.errores.map((e) => `${e.baseDatos} (${e.error})`).join('; ')}`)
      }
      await cargarReenvios()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar el reenvío')
    } finally {
      setReenviando(false)
    }
  }

  const consultar = async () => {
    setError(null)
    setCargando(true)
    setPagina(1)
    try {
      setResultado(await api<RespuestaFacturas>('/dropped/facturas-afectadas', {
        method: 'POST',
        body: JSON.stringify({ email, desde, hasta }),
      }))
    } catch (err) {
      setResultado(null)
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    } finally {
      setCargando(false)
    }
  }

  const todas = resultado?.facturas ?? []
  const noEntregadas = todas.filter((f) => f.enviado && f.estadoSendgrid && NO_ENTREGADA.includes(f.estadoSendgrid))
  const filas = soloNoEntregadas ? noEntregadas : todas
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const visibles = filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const conteo = (texto: string) => todas.filter((f) => situacion(f) === texto).length

  const exportar = async (formato: Formato) => {
    setError(null)
    try {
      await exportarArchivo(formato, {
        nombre: `facturas-${soloNoEntregadas ? 'no-entregadas' : 'notificadas'}-${email.replace(/[^A-Za-z0-9]+/g, '-')}`,
        titulo: `Facturas ${soloNoEntregadas ? 'no entregadas' : 'notificadas'} · ${email}`,
        detalle: `Fechas: ${formatoDia(desde)} a ${formatoDia(hasta)} (Colombia)`,
        columnas: COLUMNAS_EXPORTAR,
        filas,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar')
    }
  }

  return (
    <>
      <h3>Facturas afectadas</h3>
      <p className="ayuda">
        Busca en la base de facturación de cada empresa las facturas notificadas a este correo y las cruza con
        SendGrid: por número de factura cuando el envío trae asunto, y por hora de envío para los dropped (que
        SendGrid guarda sin asunto). Requiere <code>dbo.spNotificacionesPorCorreo</code> instalado en cada base.
      </p>
      <div className="acciones-form">
        <button type="button" onClick={consultar} disabled={cargando || !email}>
          {cargando ? 'Buscando en facturación…' : 'Buscar facturas en facturación'}
        </button>
        {resultado && (
          <label className="campo-check">
            <input type="checkbox" checked={soloNoEntregadas}
              onChange={(e) => { setSoloNoEntregadas(e.target.checked); setPagina(1) }} />
            Solo no entregadas (reenviar)
          </label>
        )}
        <MenuExportar onExportar={exportar} disabled={filas.length === 0} />
        {resultado && (
          <button type="button" onClick={reenviar} disabled={reenviando || seleccion.size === 0}
            title="Deja la notificación en Status 0 para que facturación la vuelva a enviar">
            {reenviando ? 'Marcando…' : `Reenviar seleccionadas (${seleccion.size})`}
          </button>
        )}
      </div>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {resultado && (
        <>
          <p className="resumen">
            {todas.length} factura(s) notificadas en {resultado.basesConsultadas} base(s)
            {['No entregada: reenviar', 'Entregada', 'Demorada: SendGrid reintenta', 'Sin registro en SendGrid', 'Facturación aún no la envía']
              .map((s) => conteo(s) > 0 && (
                <span key={s} className={`insignia ${s.startsWith('No entregada') ? 'insignia-alerta' : ''}`}>{s}: {conteo(s)}</span>
              ))}
          </p>
          {resultado.desfaseMinutos !== 0 && (
            <p className="ayuda">
              La hora de facturación y la de SendGrid difieren {resultado.desfaseMinutos} min; se tuvo en cuenta para cruzar.
            </p>
          )}
          {resultado.errores.length > 0 && (
            <p className="alerta alerta-error" role="alert">
              No se pudo consultar: {resultado.errores.map((e) => `${e.baseDatos} (${e.error})`).join('; ')}
            </p>
          )}
          {(resultado.truncadas.length > 0 || resultado.incompletoSendgrid) && (
            <p className="alerta alerta-error" role="alert">Resultado incompleto: reduce el rango de fechas.</p>
          )}
          {filas.length === 0 ? (
            <p className="vacio">{soloNoEntregadas ? 'No hay facturas sin entregar en el rango.' : 'No hay facturas notificadas a este correo.'}</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Marcar todas las de la lista"
                        checked={filas.length > 0 && filas.every((f) => seleccion.has(clave(f)))}
                        onChange={(e) => marcar(filas.map(clave), e.target.checked)}
                      />
                    </th>
                    <th>Empresa</th><th>Factura</th><th>Envío facturación</th><th>SendGrid</th><th>Situación</th><th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => (
                    <tr key={clave(f)}>
                      <td>
                        <input type="checkbox" aria-label={`Marcar ${f.factura ?? f.id}`}
                          checked={seleccion.has(clave(f))} onChange={(e) => marcar([clave(f)], e.target.checked)} />
                      </td>
                      <td>{f.empresa}<br /><small>{f.nit}</small></td>
                      <td>{f.factura ?? <small>(no es factura)</small>}</td>
                      <td>{fecha(f.fechaEnvio) || <small>sin enviar</small>}</td>
                      <td>
                        {f.estadoSendgrid && (
                          <span className={`estado estado-${f.estadoSendgrid}`} title={describirEstadoSendgrid(f.estadoSendgrid)}>
                            {f.estadoSendgrid}
                          </span>
                        )}
                        {f.cruce === 'hora' && <><br /><small title="Cruzado por hora de envío (el dropped no trae asunto)">por hora</small></>}
                      </td>
                      <td>{situacion(f)}</td>
                      <td className="respuesta">{f.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {paginas > 1 && (
            <nav className="paginacion" aria-label="Paginación">
              <button type="button" className="secundario" onClick={() => setPagina(1)} disabled={pagina <= 1} aria-label="Primera página">«</button>
              <button type="button" className="secundario" onClick={() => setPagina(pagina - 1)} disabled={pagina <= 1}>Anterior</button>
              <span>Página {pagina} de {paginas}</span>
              <button type="button" className="secundario" onClick={() => setPagina(pagina + 1)} disabled={pagina >= paginas}>Siguiente</button>
              <button type="button" className="secundario" onClick={() => setPagina(paginas)} disabled={pagina >= paginas} aria-label="Última página">»</button>
            </nav>
          )}
        </>
      )}

      {reenvios.length > 0 && (
        <>
          <h3>Seguimiento de reenvíos</h3>
          <p className="ayuda">
            El watcher de reenvíos revisa cada pocos minutos si facturación ya la volvió a enviar (vuelve a Status 1)
            y cómo terminó en SendGrid. {hayAbiertos && 'Esta lista se actualiza cada minuto.'}
          </p>
          <p className="resumen">
            {(Object.keys(TEXTO_REENVIO) as Reenvio['estado'][]).map((e) => {
              const n = reenvios.filter((r) => r.estado === e).length
              return n > 0 && <span key={e} className={`insignia estado ${CLASE_REENVIO[e]}`}>{TEXTO_REENVIO[e]}: {n}</span>
            })}
            <button type="button" className="secundario" onClick={() => void cargarReenvios()}>Actualizar</button>
          </p>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th>Factura</th><th>Empresa</th><th>Marcada</th><th>Estado</th><th>Reenvío facturación</th><th>SendGrid</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {reenvios.slice(0, 200).map((r) => (
                  <tr key={r._id}>
                    <td>{r.factura ?? r.notificacionId}</td>
                    <td>{r.empresa}<br /><small>{r.nit}</small></td>
                    <td>{fecha(r.marcadoEn)}<br /><small>{r.usuario}</small></td>
                    <td><span className={`estado ${CLASE_REENVIO[r.estado]}`}>{TEXTO_REENVIO[r.estado]}</span></td>
                    <td>{fecha(r.fechaReenvio)}</td>
                    <td>{r.estadoSendgrid && <span className={`estado estado-${r.estadoSendgrid}`}>{r.estadoSendgrid}</span>}</td>
                    <td className="respuesta">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reenvios.length > 200 && <p className="ayuda">Se muestran los 200 más recientes de {reenvios.length}.</p>}
        </>
      )}
    </>
  )
}
