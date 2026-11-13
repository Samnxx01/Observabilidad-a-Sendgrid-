import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api } from '../api/cliente.ts'
import MenuExportar from './MenuExportar.tsx'
import SeleccionMultiple from './SeleccionMultiple.tsx'
import FacturasAfectadas from './FacturasAfectadas.tsx'
import { describirEstadoSendgrid } from '../utils/estados.ts'
import { exportarArchivo, type Columna, type Formato } from '../utils/exportar.ts'

interface Mensaje {
  sg_message_id: string
  subject: string
  to_email: string
  status: string
  reason?: string
  sg_message_id_created_at: string
}

interface ListaSupresion {
  lista: string
  // null = no se pudo consultar (ver error)
  presente: boolean | null
  fecha?: string | null
  motivo?: string | null
  error?: string
}

interface RespuestaTrazabilidad {
  email: string
  supresion: { suprimido: boolean; listas: ListaSupresion[] }
  messages: Mensaje[]
  incompleto?: boolean
}

const NOMBRES_LISTA: Record<string, string> = {
  bounces: 'Bounces (rebotes)',
  invalid_emails: 'Correos inválidos',
  blocks: 'Bloqueados',
  spam_reports: 'Reportes de spam',
}

// Orden de las columnas de la linea de tiempo
const ESTADOS = ['delivered', 'processed', 'deferred', 'bounced', 'blocked', 'dropped']
const RECHAZOS = ['deferred', 'bounced', 'blocked']
const POR_PAGINA = 50
const DIAS_HISTORIAL_SENDGRID = 30

// 'YYYY-MM-DD' en hora Colombia
const formatoIso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' })
const diaColombia = (diasAtras = 0) => formatoIso.format(new Date(Date.now() - diasAtras * 24 * 3600 * 1000))

const formatoDia = (dia: string) => dia.split('-').reverse().join('/')

const formatoFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })
const fecha = (iso?: string | null) => (iso ? formatoFecha.format(new Date(iso)) : '—')
const diaDe = (iso: string) => formatoIso.format(new Date(iso))

// Asunto DIAN: NIT;RazonSocial;Factura;... (los dropped vienen sin asunto)
const parteAsunto = (m: Mensaje, posicion: number) => m.subject?.split(';')[posicion]?.trim() ?? ''

const COLUMNAS_EXPORTAR: Columna<Mensaje>[] = [
  { titulo: 'Fecha (Colombia)', valor: (m) => fecha(m.sg_message_id_created_at), ancho: 16 },
  { titulo: 'Estado', valor: (m) => m.status, ancho: 11 },
  { titulo: 'Empresa', valor: (m) => parteAsunto(m, 1), ancho: 28 },
  { titulo: 'Factura', valor: (m) => parteAsunto(m, 2), ancho: 12 },
  { titulo: 'Respuesta', valor: (m) => m.reason, ancho: 60 },
  { titulo: 'Message ID', valor: (m) => m.sg_message_id, ancho: 45 },
]

// Que paso ese dia con el buzon; alerta = no se entrego nada
const lecturaDia = (conteo: Record<string, number>) => {
  const n = (e: string) => conteo[e] ?? 0
  const rechazos = n('bounced') + n('blocked')
  if (n('delivered') === 0 && n('dropped') > 0) return { alerta: true, texto: 'Nada entregado: todo descartado por supresión' }
  if (n('delivered') === 0 && rechazos > 0) return { alerta: true, texto: 'Nada entregado: el buzón rechazó los envíos' }
  if (n('delivered') === 0 && n('deferred') > 0) return { alerta: true, texto: 'Nada entregado aún: SendGrid sigue reintentando' }
  if (n('dropped') > 0 || rechazos > 0) return { alerta: false, texto: 'Entregando, con algunos descartados o rechazados' }
  return { alerta: false, texto: 'Entregando' }
}

// El mas reciente que cumple la condicion (los mensajes vienen del mas reciente al mas antiguo)
const ultimo = (mensajes: Mensaje[], condicion: (m: Mensaje) => boolean) => mensajes.find(condicion)

interface Props {
  // Correo con el que arranca; si viene, se consulta al abrir
  correoInicial?: string
}

// Trazabilidad de un destinatario en SendGrid (via /api/dropped/trazabilidad, solo lectura):
// si hoy esta en una lista de supresion y como terminaron sus envios dia a dia en los ultimos 30 dias.
// Sirve para ver, despues de quitarlo de la supresion, si ya se entrega o vuelve a rebotar.
export default function TrazabilidadDestinatario({ correoInicial = '' }: Props) {
  const id = useId()
  const [correo, setCorreo] = useState(correoInicial)
  const [desde, setDesde] = useState(() => diaColombia(DIAS_HISTORIAL_SENDGRID))
  const [hasta, setHasta] = useState(() => diaColombia())
  const [estados, setEstados] = useState<string[]>([])
  const [resultado, setResultado] = useState<RespuestaTrazabilidad | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pagina, setPagina] = useState(1)
  const seccion = useRef<HTMLElement>(null)

  useEffect(() => setPagina(1), [resultado, estados])

  const consultar = async (email: string) => {
    setError(null)
    setCargando(true)
    try {
      setResultado(await api<RespuestaTrazabilidad>('/dropped/trazabilidad', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), desde, hasta }),
      }))
    } catch (err) {
      setResultado(null)
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    } finally {
      setCargando(false)
    }
  }

  // Abierto desde otra parte con un correo: consulta de una vez y se muestra
  useEffect(() => {
    if (correoInicial) {
      seccion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      void consultar(correoInicial)
    }
    // Solo al montar: el padre cambia la key para abrir otro correo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buscar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    void consultar(correo)
  }

  const todos = resultado?.messages ?? []
  const mensajes = todos.filter((m) => estados.length === 0 || estados.includes(m.status))
  const estadosPresentes = ESTADOS.filter((e) => todos.some((m) => m.status === e))
    .concat([...new Set(todos.map((m) => m.status))].filter((e) => !ESTADOS.includes(e)))

  // Conteo por dia y estado, del dia mas reciente al mas antiguo
  const porDia = new Map<string, Record<string, number>>()
  todos.forEach((m) => {
    const dia = diaDe(m.sg_message_id_created_at)
    const conteo = porDia.get(dia) ?? {}
    conteo[m.status] = (conteo[m.status] ?? 0) + 1
    porDia.set(dia, conteo)
  })
  const dias = [...porDia.entries()].sort(([a], [b]) => b.localeCompare(a))

  const ultimoEntregado = ultimo(todos, (m) => m.status === 'delivered')
  const ultimoRechazo = ultimo(todos, (m) => RECHAZOS.includes(m.status))
  const ultimoDropped = ultimo(todos, (m) => m.status === 'dropped')
  const ultimoEnvio = todos[0]

  // Lectura rapida del estado actual
  const diagnostico = () => {
    if (!resultado) return ''
    if (resultado.supresion.suprimido) {
      return 'Está en una lista de supresión: SendGrid descarta (dropped) cada envío nuevo a este correo.'
    }
    if (!ultimoEnvio) return 'No está suprimido y no tiene envíos en el rango.'
    switch (ultimoEnvio.status) {
      case 'delivered': return 'No está suprimido y el último envío se entregó: el buzón está recibiendo.'
      case 'deferred': return 'No está suprimido; el último envío está demorado y SendGrid sigue reintentando (hasta 72 h).'
      case 'dropped': return 'No está suprimido hoy, pero el último envío salió dropped: lo sacaron de la lista después de ese envío.'
      default: return `No está suprimido; el último envío terminó ${ultimoEnvio.status}: revisa la respuesta del servidor receptor.`
    }
  }

  const paginas = Math.max(1, Math.ceil(mensajes.length / POR_PAGINA))
  const visibles = mensajes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const exportar = async (formato: Formato) => {
    setError(null)
    try {
      await exportarArchivo(formato, {
        nombre: `trazabilidad-${resultado?.email.replace(/[^A-Za-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}`,
        titulo: `Trazabilidad en SendGrid · ${resultado?.email}`,
        detalle: [
          `Fechas: ${formatoDia(desde)} a ${formatoDia(hasta)} (Colombia)`,
          resultado?.supresion.suprimido ? 'Suprimido hoy' : 'No suprimido hoy',
          estados.length > 0 && `Estados: ${estados.join(', ')}`,
        ].filter(Boolean).join(' · '),
        columnas: COLUMNAS_EXPORTAR,
        filas: mensajes,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar')
    }
  }

  return (
    <section ref={seccion}>
      <form className="busqueda" onSubmit={buscar}>
        <div className="campo">
          <label htmlFor={`${id}-correo`}>Correo del destinatario</label>
          <input
            id={`${id}-correo`}
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="buzon@dominio.com"
          />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-desde`}>Desde</label>
          <input id={`${id}-desde`} type="date" min={diaColombia(DIAS_HISTORIAL_SENDGRID)} max={hasta || diaColombia()}
            value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-hasta`}>Hasta</label>
          <input id={`${id}-hasta`} type="date" min={desde || diaColombia(DIAS_HISTORIAL_SENDGRID)} max={diaColombia()}
            value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <SeleccionMultiple
          id={`${id}-estados`}
          etiqueta="Estado (detalle)"
          opciones={estadosPresentes.map((e) => ({ valor: e, texto: e }))}
          seleccion={estados}
          onCambio={setEstados}
          disabled={!resultado}
        />
        <div className="acciones-form">
          <button type="submit" disabled={cargando}>{cargando ? 'Consultando…' : 'Ver trazabilidad'}</button>
          <MenuExportar onExportar={exportar} disabled={mensajes.length === 0} />
        </div>
      </form>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {resultado && (
        <>
          <h3>Estado actual · {resultado.email}</h3>
          <p className="resumen">
            <span className={`insignia ${resultado.supresion.suprimido ? 'insignia-alerta' : 'insignia-ok'}`}>
              {resultado.supresion.suprimido ? '⚠ Suprimido hoy' : '✓ No suprimido'}
            </span>
            {' '}{diagnostico()}
          </p>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th>Lista de supresión</th><th>¿Está?</th><th>Desde</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {resultado.supresion.listas.map((l) => (
                  <tr key={l.lista}>
                    <td>{NOMBRES_LISTA[l.lista] ?? l.lista}</td>
                    <td>{l.presente === null ? 'No se pudo consultar' : l.presente ? <strong>Sí</strong> : 'No'}</td>
                    <td>{l.presente ? fecha(l.fecha) : ''}</td>
                    <td className="respuesta">{l.error ?? l.motivo ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Resumen del rango</h3>
          <p className="resumen">
            {todos.length} envío(s)
            {estadosPresentes.map((e) => (
              <span key={e} className={`insignia estado estado-${e}`}>
                {e}: {todos.filter((m) => m.status === e).length}
              </span>
            ))}
          </p>
          <ul>
            <li>Último envío: {fecha(ultimoEnvio?.sg_message_id_created_at)} {ultimoEnvio && `(${ultimoEnvio.status})`}</li>
            <li>Último entregado: {fecha(ultimoEntregado?.sg_message_id_created_at)}</li>
            <li>Último rechazo del buzón (deferred, bounced, blocked): {fecha(ultimoRechazo?.sg_message_id_created_at)}
              {ultimoRechazo && ` · ${ultimoRechazo.status}: ${ultimoRechazo.reason ?? ''}`}</li>
            <li>Último descartado por supresión (dropped): {fecha(ultimoDropped?.sg_message_id_created_at)}</li>
          </ul>
          {resultado.incompleto && (
            <p className="alerta alerta-error" role="alert">Hay más envíos de los que se pueden traer; reduce el rango de fechas.</p>
          )}

          {dias.length > 0 && (
            <>
              <h3>Línea de tiempo por día (Colombia)</h3>
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Día</th>
                      {estadosPresentes.map((e) => <th key={e}>{e}</th>)}
                      <th>Lectura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map(([dia, conteo]) => {
                      const lectura = lecturaDia(conteo)
                      return (
                        <tr key={dia} className={lectura.alerta ? 'fila-alerta' : undefined}>
                          <td>{formatoDia(dia)}</td>
                          {estadosPresentes.map((e) => (
                            <td key={e}>
                              {conteo[e] ? <span className={`estado estado-${e}`}>{conteo[e]}</span> : <span className="cero">0</span>}
                            </td>
                          ))}
                          <td>{lectura.texto}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <FacturasAfectadas email={resultado.email} desde={desde} hasta={hasta} />

          <h3>Detalle de envíos</h3>
          {mensajes.length === 0 ? (
            <p className="vacio">No hay envíos para esta búsqueda.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Estado</th><th>Empresa</th><th>Factura</th><th>Respuesta</th><th>Message ID</th></tr>
                </thead>
                <tbody>
                  {visibles.map((m) => (
                    <tr key={`${m.sg_message_id}-${m.status}`}>
                      <td>{fecha(m.sg_message_id_created_at)}</td>
                      <td><span className={`estado estado-${m.status}`} title={describirEstadoSendgrid(m.status)}>{m.status}</span></td>
                      <td>{parteAsunto(m, 1)}</td>
                      <td>{parteAsunto(m, 2)}</td>
                      <td className="respuesta">{m.reason}</td>
                      <td className="respuesta"><code>{m.sg_message_id}</code></td>
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
    </section>
  )
}
