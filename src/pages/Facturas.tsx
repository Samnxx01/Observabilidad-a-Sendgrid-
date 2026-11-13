import { useRespuestaTiempoReal } from '../components/useRespuestaTiempoReal.ts'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/cliente.ts'
import { obtenerBases, type BaseAuditoria } from '../api/auditoria.ts'
import { AyudaFacturas } from '../components/AyudasEstados.tsx'
import MenuExportar from '../components/MenuExportar.tsx'
import { describirEstadoSendgrid, ESTADOS_SENDGRID } from '../utils/estados.ts'
import SeleccionMultiple from '../components/SeleccionMultiple.tsx'
import { separarValores } from '../utils/descargas.ts'
import { exportarArchivo, type Columna, type Formato } from '../utils/exportar.ts'

interface Mensaje {
  sg_message_id: string
  subject: string
  from_email?: string
  to_email: string
  status: string
  reason?: string
  sg_message_id_created_at: string
}

interface RespuestaFacturas {
  empresas: { nit: string; nombre: string; baseDatos: string }[]
  messages: Mensaje[]
  // true si algun NIT/factura tenia mas envios de los que el backend alcanza a paginar
  incompleto?: boolean
}

// Mensajes por consulta a SendGrid; el backend pagina hasta traer todo el rango de fechas
const LIMITE = 1000
// Filas por pagina de la tabla (la exportacion incluye todas)
const POR_PAGINA = 50

// SendGrid solo guarda 30 dias; el backend sube un desde mas antiguo al minimo permitido
const DIAS_HISTORIAL_SENDGRID = 30

// 'YYYY-MM-DD' en hora Colombia, n dias atras
const diaColombia = (diasAtras = 0) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' })
    .format(new Date(Date.now() - diasAtras * 24 * 3600 * 1000))

const formatoDia = (dia: string) => dia.split('-').reverse().join('/')

// Rango buscado; sin fechas SendGrid usa sus ultimos 30 dias
const textoRango = ({ desde, hasta }: { desde: string; hasta: string }) =>
  `${desde ? formatoDia(desde) : 'últimos 30 días'} a ${hasta ? formatoDia(hasta) : 'hoy'}`

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

const fecha = (m: Mensaje) => formatoFecha.format(new Date(m.sg_message_id_created_at))

// Asunto DIAN: NIT;RazonSocial;Factura;TipoDocumento;NombreComercial
const parteAsunto = (m: Mensaje, posicion: number) => m.subject.split(';')[posicion]?.trim() ?? ''

const COLUMNAS_EXPORTAR: Columna<Mensaje>[] = [
  { titulo: 'Fecha (Colombia)', valor: fecha, ancho: 16 },
  { titulo: 'NIT', valor: (m) => parteAsunto(m, 0), ancho: 12 },
  { titulo: 'Razón social', valor: (m) => parteAsunto(m, 1), ancho: 28 },
  { titulo: 'Factura', valor: (m) => parteAsunto(m, 2), ancho: 12 },
  { titulo: 'Destinatario', valor: (m) => m.to_email, ancho: 30 },
  { titulo: 'Estado', valor: (m) => m.status, ancho: 11 },
  { titulo: 'Respuesta', valor: (m) => m.reason, ancho: 60 },
  { titulo: 'Message ID', valor: (m) => m.sg_message_id, ancho: 45 },
]

export default function Facturas() {
  const [nits, setNits] = useState<string[]>([])
  const [facturas, setFacturas] = useState('')
  const [estados, setEstados] = useState<string[]>([])
  // Destinatarios separados por coma o espacio; cada uno filtra por "contiene", sin distinguir mayusculas
  const [destinatario, setDestinatario] = useState('')
  const [desde, setDesde] = useState(() => diaColombia(DIAS_HISTORIAL_SENDGRID))
  const [hasta, setHasta] = useState(() => diaColombia())
  // Rango de la ultima busqueda, para el resumen y la exportacion
  const [rangoBuscado, setRangoBuscado] = useState({ desde: '', hasta: '' })
  const [resultado, setResultado] = useState<RespuestaFacturas | null>(null)
  useRespuestaTiempoReal<RespuestaFacturas>('/sendgrid/facturas', setResultado)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [empresas, setEmpresas] = useState<BaseAuditoria[]>([])
  // Facturas de la ultima busqueda, para saber cuales no devolvio SendGrid
  const [buscadas, setBuscadas] = useState<string[]>([])
  const [copiado, setCopiado] = useState(false)
  const [pagina, setPagina] = useState(1)

  // Un resultado nuevo o un cambio de estado o destinatario vuelve a la primera pagina
  useEffect(() => setPagina(1), [resultado, estados, destinatario])

  // Empresas de las bases configuradas en la auditoria (basesauditoria)
  useEffect(() => {
    obtenerBases()
      .then(setEmpresas)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las empresas'))
  }, [])

  const buscar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setCargando(true)
    try {
      // Los numeros de factura DIAN van en mayusculas y el LIKE de SendGrid distingue mayusculas
      const lista = separarValores(facturas.toUpperCase())
      setResultado(await api<RespuestaFacturas>('/sendgrid/facturas', {
        method: 'POST',
        // Todos los filtros son opcionales; los vacios no filtran
        body: JSON.stringify({
          nits, facturas: lista, limit: LIMITE, desde, hasta, estados, destinatarios: separarValores(destinatario),
        }),
      }))
      setBuscadas(lista)
      setRangoBuscado({ desde, hasta })
    } catch (err) {
      setResultado(null)
      setBuscadas([])
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    } finally {
      setCargando(false)
    }
  }

  // Estado y destinatario se envian a SendGrid al buscar y ademas filtran lo ya traido sin volver a
  // consultar (el destinatario parcial solo se puede filtrar aqui)
  const opcionesEstado = [...new Set([
    ...ESTADOS_SENDGRID.map((e) => e.estado),
    ...(resultado?.messages.map((m) => m.status) ?? []),
  ])]
  const destinatarios = separarValores(destinatario.toLowerCase())
  const mensajes = resultado?.messages.filter((m) =>
    (estados.length === 0 || estados.includes(m.status))
    && (destinatarios.length === 0 || destinatarios.some((d) => m.to_email.toLowerCase().includes(d)))) ?? []
  const paginas = Math.max(1, Math.ceil(mensajes.length / POR_PAGINA))
  const visibles = mensajes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  // Facturas buscadas sin ningun envio en SendGrid (en ninguna de las empresas elegidas)
  const conEnvios = new Set(resultado?.messages.map((m) => parteAsunto(m, 2).toUpperCase()) ?? [])
  const noEncontradas = buscadas.filter((f) => !conEnvios.has(f))

  const copiarNoEncontradas = async () => {
    try {
      await navigator.clipboard.writeText(noEncontradas.join(', '))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  // Exporta todo lo que arrojo la busqueda (todas las paginas, no solo la visible) con los filtros
  // de estado y destinatario aplicados
  const exportar = async (formato: Formato) => {
    setError(null)
    // Empresa del resumen en el titulo y en el nombre del archivo
    const empresa = !resultado?.empresas.length ? 'Todas las empresas'
      : resultado.empresas.length === 1 ? resultado.empresas[0].nombre
        : `${resultado.empresas.length} empresas`
    const empresaArchivo = empresa.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    try {
      await exportarArchivo(formato, {
        nombre: `facturas-sendgrid-${empresaArchivo}-${new Date().toISOString().slice(0, 10)}`,
        titulo: `Envíos de facturas en SendGrid · ${empresa}`,
        detalle: [
          resultado?.empresas.length ? resultado.empresas.map((e) => `${e.nombre} (${e.nit})`).join(', ') : 'Todas las empresas',
          `Fechas: ${textoRango(rangoBuscado)} (Colombia)`,
          buscadas.length > 0 && `Facturas encontradas: ${buscadas.length - noEncontradas.length} de ${buscadas.length}`,
          noEncontradas.length > 0 && `No encontradas: ${noEncontradas.join(', ')}`,
          estados.length > 0 && `Estados: ${estados.join(', ')}`,
          destinatarios.length > 0 && `Destinatarios: ${destinatarios.join(', ')}`,
          resultado?.incompleto && 'Resultado incompleto: hay más envíos en el rango',
        ].filter(Boolean).join(' · '),
        columnas: COLUMNAS_EXPORTAR,
        filas: mensajes,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar')
    }
  }

  return (
    <main className="contenido">
      <div className="cabecera-ayuda"><AyudaFacturas /></div>
      <form className="busqueda" onSubmit={buscar}>
        <SeleccionMultiple
          id="empresas"
          etiqueta="Empresas"
          opciones={empresas.map((b) => ({ valor: b.nit, texto: `${b.nombre ?? b.baseDatos} · ${b.nit}` }))}
          seleccion={nits}
          onCambio={setNits}
          textoTodos="Todas"
        />
        <div className="campo">
          <label htmlFor="facturas">Facturas (opcional)</label>
          <input
            id="facturas"
            value={facturas}
            onChange={(e) => setFacturas(e.target.value)}
            placeholder="CS307738, QC231168"
            title="Varias facturas separadas por coma o espacio"
          />
        </div>
        <div className="campo">
          <label htmlFor="desde">Desde</label>
          <input
            id="desde"
            type="date"
            min={diaColombia(DIAS_HISTORIAL_SENDGRID)}
            max={hasta || diaColombia()}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            title="SendGrid solo guarda los últimos 30 días"
          />
        </div>
        <div className="campo">
          <label htmlFor="hasta">Hasta</label>
          <input
            id="hasta"
            type="date"
            min={desde || diaColombia(DIAS_HISTORIAL_SENDGRID)}
            max={diaColombia()}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <SeleccionMultiple
          id="estados"
          etiqueta="Estado"
          opciones={opcionesEstado.map((e) => ({ valor: e, texto: e }))}
          seleccion={estados}
          onCambio={setEstados}
        />
        <div className="campo">
          <label htmlFor="destinatario">Destinatarios</label>
          <input
            id="destinatario"
            type="search"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            placeholder="a@dominio.com, b@dominio.com"
            title="Varios separados por coma o espacio. Correos completos: los filtra SendGrid. Parte de un correo: filtra los resultados traídos"
          />
        </div>
        <div className="acciones-form">
          <button type="submit" disabled={cargando}>
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
          <MenuExportar onExportar={exportar} disabled={mensajes.length === 0} />
        </div>
      </form>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {resultado && (
        <section>
          <p className="resumen">
            {resultado.empresas.length === 0 ? 'Todas las empresas' : resultado.empresas.length === 1 ? resultado.empresas[0].nombre : `${resultado.empresas.length} empresas`}
            {` · ${textoRango(rangoBuscado)}`}
            {' · '}{mensajes.length} envío(s)
            {mensajes.length < resultado.messages.length && ` de ${resultado.messages.length}`}
            {buscadas.length > 0 && (
              <span className={`insignia ${noEncontradas.length ? 'insignia-alerta' : 'insignia-ok'}`}>
                {noEncontradas.length ? '⚠' : '✓'} {buscadas.length - noEncontradas.length} de {buscadas.length}
                {' '}factura(s) encontrada(s)
              </span>
            )}
          </p>
          {resultado.incompleto && (
            <p className="alerta alerta-error" role="alert">
              Hay más envíos de los que se pueden traer en una búsqueda; reduce el rango de fechas o busca por facturas.
            </p>
          )}
          {noEncontradas.length > 0 && (
            <details className="no-encontradas">
              <summary>Ver no encontradas ({noEncontradas.length})</summary>
              <p>SendGrid no tiene envíos de estas facturas en {textoRango(rangoBuscado)} para las empresas elegidas:</p>
              <ul>
                {noEncontradas.map((f) => <li key={f}><code>{f}</code></li>)}
              </ul>
              <button type="button" className="secundario" onClick={copiarNoEncontradas}>
                {copiado ? 'Copiado ✓' : 'Copiar lista'}
              </button>
            </details>
          )}
          {mensajes.length === 0 ? (
            <p className="vacio">No hay envíos para esta búsqueda.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    {resultado.empresas.length !== 1 && <th>Empresa</th>}
                    <th>Factura</th>
                    <th>Destinatario</th>
                    <th>Estado</th>
                    <th>Respuesta</th>
                    <th>Message ID</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((m) => (
                    <tr key={`${m.sg_message_id}-${m.status}`}>
                      <td>{fecha(m)}</td>
                      {resultado.empresas.length !== 1 && <td>{parteAsunto(m, 1)}<br />{parteAsunto(m, 0)}</td>}
                      <td>{parteAsunto(m, 2)}</td>
                      <td>{m.to_email}</td>
                      <td><span className={`estado estado-${m.status}`} title={describirEstadoSendgrid(m.status)}>{m.status}</span></td>
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
              <button type="button" className="secundario" onClick={() => setPagina(1)}
                disabled={pagina <= 1} aria-label="Primera página">«</button>
              <button type="button" className="secundario" onClick={() => setPagina(pagina - 1)}
                disabled={pagina <= 1}>Anterior</button>
              <span>Página {pagina} de {paginas}</span>
              <button type="button" className="secundario" onClick={() => setPagina(pagina + 1)}
                disabled={pagina >= paginas}>Siguiente</button>
              <button type="button" className="secundario" onClick={() => setPagina(paginas)}
                disabled={pagina >= paginas} aria-label="Última página">»</button>
            </nav>
          )}
        </section>
      )}
    </main>
  )
}
