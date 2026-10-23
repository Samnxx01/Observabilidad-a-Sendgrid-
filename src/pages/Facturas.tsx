import { useRespuestaTiempoReal } from '../components/useRespuestaTiempoReal.ts'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/cliente.ts'
import { obtenerBases, type BaseAuditoria } from '../api/auditoria.ts'
import { AyudaFacturas } from '../components/AyudasEstados.tsx'
import MenuExportar from '../components/MenuExportar.tsx'
import { describirEstadoSendgrid } from '../utils/estados.ts'
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
}

// Maximo de mensajes por consulta a SendGrid (una consulta por NIT y factura)
const LIMITE = 1000

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
]

export default function Facturas() {
  const [nits, setNits] = useState<string[]>([])
  const [facturas, setFacturas] = useState('')
  const [estados, setEstados] = useState<string[]>([])
  const [resultado, setResultado] = useState<RespuestaFacturas | null>(null)
  useRespuestaTiempoReal<RespuestaFacturas>('/sendgrid/facturas', setResultado)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [empresas, setEmpresas] = useState<BaseAuditoria[]>([])
  // Facturas de la ultima busqueda, para saber cuales no devolvio SendGrid
  const [buscadas, setBuscadas] = useState<string[]>([])
  const [copiado, setCopiado] = useState(false)

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
        body: JSON.stringify({ nits, facturas: lista, limit: LIMITE }),
      }))
      setBuscadas(lista)
    } catch (err) {
      setResultado(null)
      setBuscadas([])
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    } finally {
      setCargando(false)
    }
  }

  // El estado se filtra sobre lo que devolvio SendGrid; las opciones son los estados presentes
  const estadosPresentes = [...new Set(resultado?.messages.map((m) => m.status) ?? [])].sort()
  const mensajes = resultado?.messages.filter((m) => estados.length === 0 || estados.includes(m.status)) ?? []

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

  // Exporta lo que muestra la tabla (todos los envios de la busqueda con el filtro de estado)
  const exportar = async (formato: Formato) => {
    setError(null)
    try {
      await exportarArchivo(formato, {
        nombre: `facturas-sendgrid-${new Date().toISOString().slice(0, 10)}`,
        titulo: 'Envíos de facturas en SendGrid',
        detalle: [
          resultado?.empresas.map((e) => `${e.nombre} (${e.nit})`).join(', '),
          buscadas.length > 0 && `Facturas encontradas: ${buscadas.length - noEncontradas.length} de ${buscadas.length}`,
          noEncontradas.length > 0 && `No encontradas: ${noEncontradas.join(', ')}`,
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
    <main className="contenido">
      <div className="cabecera-ayuda"><AyudaFacturas /></div>
      <form className="busqueda" onSubmit={buscar}>
        <SeleccionMultiple
          id="empresas"
          etiqueta="Empresas"
          opciones={empresas.map((b) => ({ valor: b.nit, texto: `${b.nombre ?? b.baseDatos} · ${b.nit}` }))}
          seleccion={nits}
          onCambio={setNits}
          textoTodos="Selecciona…"
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
        <SeleccionMultiple
          id="estados"
          etiqueta="Estado"
          opciones={estadosPresentes.map((e) => ({ valor: e, texto: e }))}
          seleccion={estados}
          onCambio={setEstados}
          disabled={!resultado}
        />
        <div className="acciones-form">
          <button type="submit" disabled={cargando || nits.length === 0}>
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
          <MenuExportar onExportar={exportar} disabled={mensajes.length === 0} />
        </div>
      </form>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {resultado && (
        <section>
          <p className="resumen">
            {resultado.empresas.length === 1 ? resultado.empresas[0].nombre : `${resultado.empresas.length} empresas`}
            {' · '}{mensajes.length} envío(s)
            {mensajes.length < resultado.messages.length && ` de ${resultado.messages.length}`}
            {buscadas.length > 0 && (
              <span className={`insignia ${noEncontradas.length ? 'insignia-alerta' : 'insignia-ok'}`}>
                {noEncontradas.length ? '⚠' : '✓'} {buscadas.length - noEncontradas.length} de {buscadas.length}
                {' '}factura(s) encontrada(s)
              </span>
            )}
          </p>
          {noEncontradas.length > 0 && (
            <details className="no-encontradas">
              <summary>Ver no encontradas ({noEncontradas.length})</summary>
              <p>SendGrid no tiene envíos de estas facturas en los últimos 30 días para las empresas elegidas:</p>
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
                    {resultado.empresas.length > 1 && <th>Empresa</th>}
                    <th>Factura</th>
                    <th>Destinatario</th>
                    <th>Estado</th>
                    <th>Respuesta</th>
                  </tr>
                </thead>
                <tbody>
                  {mensajes.map((m) => (
                    <tr key={`${m.sg_message_id}-${m.status}`}>
                      <td>{fecha(m)}</td>
                      {resultado.empresas.length > 1 && <td>{parteAsunto(m, 1)}<br />{parteAsunto(m, 0)}</td>}
                      <td>{parteAsunto(m, 2)}</td>
                      <td>{m.to_email}</td>
                      <td><span className={`estado estado-${m.status}`} title={describirEstadoSendgrid(m.status)}>{m.status}</span></td>
                      <td className="respuesta">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
