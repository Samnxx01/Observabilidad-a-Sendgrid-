import { useEffect, useId, useState, type FormEvent } from 'react'
import { api } from '../api/cliente.ts'
import MenuExportar from './MenuExportar.tsx'
import SeleccionMultiple from './SeleccionMultiple.tsx'
import { separarValores } from '../utils/descargas.ts'
import { exportarArchivo, type Columna, type Formato } from '../utils/exportar.ts'
import ModalQuitarSupresion, { ACCIONES_SUPRESION, type AccionSupresion } from './ModalQuitarSupresion.tsx'

interface Mensaje {
  sg_message_id: string
  from_email?: string
  to_email: string
  reason?: string
  sg_message_id_created_at: string
}

interface RespuestaDropped {
  messages: Mensaje[]
  // true si hay mas envios de los que el backend alcanza a traer
  incompleto?: boolean
}

// Un destinatario con todos sus dropped (vista "Por destinatario")
interface Destinatario {
  to_email: string
  envios: number
  motivos: string
  listaMotivos: string[]
  primero: string
  ultimo: string
}

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

const fecha = (iso: string) => formatoFecha.format(new Date(iso))

const SIN_MOTIVO = '(sin motivo)'
const motivo = (m: Mensaje) => m.reason || SIN_MOTIVO

const COLUMNAS_ENVIOS: Columna<Mensaje>[] = [
  { titulo: 'Fecha (Colombia)', valor: (m) => fecha(m.sg_message_id_created_at), ancho: 16 },
  { titulo: 'Destinatario', valor: (m) => m.to_email, ancho: 34 },
  { titulo: 'Motivo', valor: motivo, ancho: 22 },
  { titulo: 'Remitente', valor: (m) => m.from_email, ancho: 30 },
  { titulo: 'Message ID', valor: (m) => m.sg_message_id, ancho: 45 },
]

const COLUMNAS_DESTINATARIOS: Columna<Destinatario>[] = [
  { titulo: 'Destinatario', valor: (d) => d.to_email, ancho: 34 },
  { titulo: 'Envíos dropped', valor: (d) => d.envios, ancho: 14 },
  { titulo: 'Motivo', valor: (d) => d.motivos, ancho: 26 },
  { titulo: 'Primero (Colombia)', valor: (d) => fecha(d.primero), ancho: 16 },
  { titulo: 'Último (Colombia)', valor: (d) => fecha(d.ultimo), ancho: 16 },
]

// Agrupa los envios por destinatario, del que tiene mas dropped al que tiene menos
const agrupar = (mensajes: Mensaje[]): Destinatario[] => {
  const grupos = new Map<string, { envios: number; motivos: Set<string>; primero: string; ultimo: string }>()
  mensajes.forEach((m) => {
    const clave = m.to_email.toLowerCase()
    const grupo = grupos.get(clave)
    if (!grupo) {
      grupos.set(clave, {
        envios: 1, motivos: new Set([motivo(m)]),
        primero: m.sg_message_id_created_at, ultimo: m.sg_message_id_created_at,
      })
      return
    }
    grupo.envios++
    grupo.motivos.add(motivo(m))
    if (m.sg_message_id_created_at < grupo.primero) grupo.primero = m.sg_message_id_created_at
    if (m.sg_message_id_created_at > grupo.ultimo) grupo.ultimo = m.sg_message_id_created_at
  })
  return [...grupos.entries()]
    .map(([to_email, g]) => ({
      to_email, envios: g.envios, motivos: [...g.motivos].join(', '), listaMotivos: [...g.motivos],
      primero: g.primero, ultimo: g.ultimo,
    }))
    .sort((a, b) => b.envios - a.envios || a.to_email.localeCompare(b.to_email))
}

interface Props {
  // Valores con los que arranca el formulario, ej. al abrirlo desde otra pantalla
  destinatariosIniciales?: string[]
  // Si viene, la vista por destinatario muestra un boton para ver la trazabilidad de cada correo
  onVerTrazabilidad?: (correo: string) => void
}

// Consulta independiente de los envios que SendGrid no envio por la lista de supresion (dropped,
// via /api/dropped). Se puede usar en cualquier pantalla. SendGrid los guarda sin
// asunto, por eso no se pueden filtrar por empresa ni factura: solo por fechas y destinatarios.
export default function ConsultaDropped({ destinatariosIniciales = [], onVerTrazabilidad }: Props) {
  const id = useId()
  const [destinatario, setDestinatario] = useState(destinatariosIniciales.join(', '))
  const [desde, setDesde] = useState(() => diaColombia(DIAS_HISTORIAL_SENDGRID))
  const [hasta, setHasta] = useState(() => diaColombia())
  const [motivos, setMotivos] = useState<string[]>([])
  const [porDestinatario, setPorDestinatario] = useState(false)
  // Rango de la ultima busqueda, para el resumen y la exportacion
  const [rangoBuscado, setRangoBuscado] = useState({ desde: '', hasta: '' })
  const [resultado, setResultado] = useState<RespuestaDropped | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pagina, setPagina] = useState(1)
  // Correos quitados de la supresion en esta sesion y el modal para quitarlos
  const [quitados, setQuitados] = useState<Set<string>>(new Set())
  const [modalSupresion, setModalSupresion] = useState<AccionSupresion | null>(null)

  // Un resultado nuevo o un cambio de filtro o de vista vuelve a la primera pagina
  useEffect(() => setPagina(1), [resultado, motivos, destinatario, porDestinatario])

  const buscar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    setCargando(true)
    try {
      // Todos los filtros son opcionales; los vacios no filtran
      setResultado(await api<RespuestaDropped>('/dropped/consultar', {
        method: 'POST',
        body: JSON.stringify({ desde, hasta, destinatarios: separarValores(destinatario) }),
      }))
      setRangoBuscado({ desde, hasta })
    } catch (err) {
      setResultado(null)
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    } finally {
      setCargando(false)
    }
  }

  // Motivo y destinatario parcial filtran lo ya traido sin volver a consultar
  const motivosPresentes = [...new Set(resultado?.messages.map(motivo) ?? [])].sort()
  const destinatarios = separarValores(destinatario.toLowerCase())
  const mensajes = resultado?.messages.filter((m) =>
    (motivos.length === 0 || motivos.includes(motivo(m)))
    && (destinatarios.length === 0 || destinatarios.some((d) => m.to_email.toLowerCase().includes(d)))) ?? []
  // Se agrupa siempre: lo usan la vista por destinatario y el modal de supresion
  const grupos = agrupar(mensajes)

  const filas = porDestinatario ? grupos.length : mensajes.length
  const paginas = Math.max(1, Math.ceil(filas / POR_PAGINA))
  const desdeFila = (pagina - 1) * POR_PAGINA
  const conteoPorMotivo = motivosPresentes.map((mo) => [mo, mensajes.filter((m) => motivo(m) === mo).length] as const)


  // Exporta todo lo que arrojo la busqueda (todas las paginas) en la vista elegida
  const exportar = async (formato: Formato) => {
    setError(null)
    const comun = {
      nombre: `dropped-sendgrid${porDestinatario ? '-por-destinatario' : ''}-${new Date().toISOString().slice(0, 10)}`,
      titulo: `Envíos dropped en SendGrid${porDestinatario ? ' · por destinatario' : ''}`,
      detalle: [
        `Fechas: ${textoRango(rangoBuscado)} (Colombia)`,
        destinatarios.length > 0 && `Destinatarios: ${destinatarios.join(', ')}`,
        motivos.length > 0 && `Motivos: ${motivos.join(', ')}`,
        porDestinatario && `${mensajes.length} envío(s)`,
        resultado?.incompleto && 'Resultado incompleto: hay más envíos en el rango',
      ].filter(Boolean).join(' · '),
    }
    try {
      if (porDestinatario) {
        await exportarArchivo(formato, { ...comun, columnas: COLUMNAS_DESTINATARIOS, filas: grupos })
      } else {
        await exportarArchivo(formato, { ...comun, columnas: COLUMNAS_ENVIOS, filas: mensajes })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar')
    }
  }

  return (
    <>
      <form className="busqueda" onSubmit={buscar}>
        <div className="campo">
          <label htmlFor={`${id}-destinatario`}>Destinatarios</label>
          <input
            id={`${id}-destinatario`}
            type="search"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            placeholder="a@dominio.com, b@dominio.com"
            title="Varios separados por coma o espacio. Correos completos: los filtra SendGrid. Parte de un correo: filtra los resultados traídos"
          />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-desde`}>Desde</label>
          <input
            id={`${id}-desde`}
            type="date"
            min={diaColombia(DIAS_HISTORIAL_SENDGRID)}
            max={hasta || diaColombia()}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            title="SendGrid solo guarda los últimos 30 días"
          />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-hasta`}>Hasta</label>
          <input
            id={`${id}-hasta`}
            type="date"
            min={desde || diaColombia(DIAS_HISTORIAL_SENDGRID)}
            max={diaColombia()}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <SeleccionMultiple
          id={`${id}-motivos`}
          etiqueta="Motivo"
          opciones={motivosPresentes.map((m) => ({ valor: m, texto: m }))}
          seleccion={motivos}
          onCambio={setMotivos}
          disabled={!resultado}
        />
        <div className="campo">
          <label htmlFor={`${id}-vista`}>Vista</label>
          <select
            id={`${id}-vista`}
            value={porDestinatario ? 'destinatario' : 'envios'}
            onChange={(e) => setPorDestinatario(e.target.value === 'destinatario')}
          >
            <option value="envios">Cada envío</option>
            <option value="destinatario">Por destinatario</option>
          </select>
        </div>
        <div className="acciones-form">
          <button type="submit" disabled={cargando}>
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
          <MenuExportar onExportar={exportar} disabled={filas === 0} />
          {(Object.keys(ACCIONES_SUPRESION) as AccionSupresion[]).map((accion) => (
            <button key={accion} type="button" className="secundario"
              onClick={() => setModalSupresion(accion)} disabled={grupos.length === 0}
              title={ACCIONES_SUPRESION[accion].ayuda}>
              Quitar de {ACCIONES_SUPRESION[accion].nombre}?
            </button>
          ))}
        </div>
      </form>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {resultado && (
        <section>
          <p className="resumen">
            {textoRango(rangoBuscado)}
            {' · '}{mensajes.length} envío(s) dropped
            {mensajes.length < resultado.messages.length && ` de ${resultado.messages.length}`}
            {' · '}{porDestinatario ? grupos.length : new Set(mensajes.map((m) => m.to_email.toLowerCase())).size} destinatario(s)
            {conteoPorMotivo.map(([mo, n]) => <span key={mo} className="insignia">{mo}: {n}</span>)}
          </p>
          {resultado.incompleto && (
            <p className="alerta alerta-error" role="alert">
              Hay más envíos de los que se pueden traer en una búsqueda; reduce el rango de fechas o busca por destinatarios.
            </p>
          )}
          {filas === 0 ? (
            <p className="vacio">No hay envíos dropped para esta búsqueda.</p>
          ) : (
            <div className="tabla-scroll">
              {porDestinatario ? (
                <table>
                  <thead>
                    <tr>
                      <th>Destinatario</th>
                      <th>Envíos</th>
                      <th>Motivo</th>
                      <th>Primero</th>
                      <th>Último</th>
                      {onVerTrazabilidad && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.slice(desdeFila, desdeFila + POR_PAGINA).map((d) => (
                      <tr key={d.to_email}>
                        <td>
                          {d.to_email}
                          {quitados.has(`dropped|${d.to_email}`) && (
                            <span className="insignia insignia-ok" title="Quitado de la lista de supresión">✓ quitado</span>
                          )}
                        </td>
                        <td>{d.envios}</td>
                        <td>{d.motivos}</td>
                        <td>{fecha(d.primero)}</td>
                        <td>{fecha(d.ultimo)}</td>
                        {onVerTrazabilidad && (
                          <td>
                            <button type="button" className="secundario" onClick={() => onVerTrazabilidad(d.to_email)}>
                              Trazabilidad
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Destinatario</th>
                      <th>Motivo</th>
                      <th>Remitente</th>
                      <th>Message ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mensajes.slice(desdeFila, desdeFila + POR_PAGINA).map((m) => (
                      <tr key={m.sg_message_id}>
                        <td>{fecha(m.sg_message_id_created_at)}</td>
                        <td>{m.to_email}</td>
                        <td><span className="estado estado-dropped">{motivo(m)}</span></td>
                        <td>{m.from_email}</td>
                        <td className="respuesta"><code>{m.sg_message_id}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
      {modalSupresion && (
        <ModalQuitarSupresion
          accion={modalSupresion}
          destinatarios={grupos}
          quitados={quitados}
          onQuitados={(emails) => setQuitados((actual) => new Set([...actual, ...emails]))}
          onCerrar={() => setModalSupresion(null)}
        />
      )}
    </>
  )
}
