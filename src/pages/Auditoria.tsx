import { useEffect, useState, type FormEvent } from 'react'
import {
  consultarRechazos,
  exportarRechazos,
  obtenerBases,
  sincronizarAuditoria,
  type BaseAuditoria,
  type FiltrosRechazos,
  type RechazoExportado,
  type RespuestaRechazos,
  type ResultadoSincronizacion,
} from '../api/auditoria.ts'
import MenuExportar from '../components/MenuExportar.tsx'
import ModalBasesAuditoria from '../components/ModalBasesAuditoria.tsx'
import SeleccionMultiple from '../components/SeleccionMultiple.tsx'
import { separarValores } from '../utils/descargas.ts'
import { exportarArchivo, type Columna, type Formato } from '../utils/exportar.ts'

const ESTADOS = ['deferred', 'bounced', 'blocked', 'dropped'] as const
const POR_PAGINA = 5

// Opcion del filtro de estado que no es un estado de SendGrid: deferred sin resolver
const PENDIENTES = 'pendientes'

const OPCIONES_ESTADO = [
  ...ESTADOS.map((e) => ({ valor: e, texto: e })),
  { valor: PENDIENTES, texto: 'deferred pendientes' },
]

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

const fecha = (valor: string | null) => (valor ? formatoFecha.format(new Date(valor)) : '')

const COLUMNAS_EXPORTAR: Columna<RechazoExportado>[] = [
  { titulo: 'Fecha envío (Colombia)', valor: (r) => fecha(r.fechaEnvio), ancho: 16 },
  { titulo: 'NIT', valor: (r) => r.nit, ancho: 12 },
  { titulo: 'Razón social', valor: (r) => r.razonSocial, ancho: 26 },
  { titulo: 'Factura', valor: (r) => r.factura, ancho: 12 },
  { titulo: 'Destinatario', valor: (r) => r.toEmail, ancho: 28 },
  { titulo: 'Estado', valor: (r) => r.estado, ancho: 10 },
  { titulo: 'Tipo falla', valor: (r) => r.tipoFalla, ancho: 12 },
  { titulo: 'SMTP', valor: (r) => r.codigoSmtp, ancho: 10 },
  { titulo: 'Respuesta', valor: (r) => r.reason, ancho: 60 },
  {
    titulo: 'Resolución deferred',
    valor: (r) => (r.estado !== 'deferred' ? '' : r.estadoResolucion
      ? `${r.estadoResolucion} ${fecha(r.fechaResolucion)}`
      : 'Pendiente'),
    ancho: 18,
  },
]

const sumar = (resultados: ResultadoSincronizacion[], campo: 'insertados' | 'actualizados' | 'deferredResueltos') =>
  resultados.reduce((total, r) => total + (r[campo] ?? 0), 0)

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

interface Cambios {
  estados?: string[]
  nits?: string[]
}

// Rechazos de SendGrid guardados en Mongo (deferred/bounced/blocked/dropped).
// Cada filtro admite varios valores; sin valores no filtra.
export default function Auditoria() {
  const [nits, setNits] = useState<string[]>([])
  const [estados, setEstados] = useState<string[]>([])
  const [facturas, setFacturas] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  // Filtros de la ultima busqueda: la paginacion y la exportacion usan estos, no lo que se este escribiendo
  const [aplicados, setAplicados] = useState<FiltrosRechazos | null>(null)
  const [resultado, setResultado] = useState<RespuestaRechazos | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [verBases, setVerBases] = useState(false)
  const [empresas, setEmpresas] = useState<BaseAuditoria[]>([])

  // Empresas de las bases configuradas (basesauditoria) para el filtro de empresa
  const cargarEmpresas = () =>
    obtenerBases()
      .then(setEmpresas)
      .catch((err) => setError(mensajeDe(err, 'No se pudieron cargar las empresas')))

  useEffect(() => {
    cargarEmpresas()
  }, [])

  // Los filtros que cambian al instante pasan su valor nuevo porque el estado de React aun no se actualizo
  const leerFiltros = ({ estados: filtroEstados = estados, nits: filtroNits = nits }: Cambios = {}): FiltrosRechazos => ({
    nits: filtroNits,
    facturas: separarValores(facturas),
    estados: filtroEstados.filter((e) => e !== PENDIENTES),
    pendientes: filtroEstados.includes(PENDIENTES),
    desde: desde || undefined,
    hasta: hasta || undefined,
  })

  const consultar = async (filtros: FiltrosRechazos, pagina: number) => {
    setError(null)
    setCargando(true)
    try {
      setResultado(await consultarRechazos(filtros, pagina, POR_PAGINA))
      setAplicados(filtros)
    } catch (err) {
      setResultado(null)
      setError(mensajeDe(err, 'No se pudo consultar'))
    } finally {
      setCargando(false)
    }
  }

  const buscar = (cambios: Cambios = {}) => {
    setAviso(null)
    return consultar(leerFiltros(cambios), 1)
  }

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    buscar()
  }

  // Al cambiar el estado o la empresa se filtra de una vez
  const cambiarEstados = (nuevos: string[]) => {
    setEstados(nuevos)
    buscar({ estados: nuevos })
  }

  const cambiarNits = (nuevos: string[]) => {
    setNits(nuevos)
    buscar({ nits: nuevos })
  }

  const irAPagina = (pagina: number) => {
    if (aplicados) {
      consultar(aplicados, pagina)
    }
  }

  const cerrarBases = () => {
    setVerBases(false)
    cargarEmpresas()
  }

  // Descarga en Excel o PDF todos los rechazos de la busqueda (no solo la pagina visible)
  const exportar = async (formato: Formato) => {
    setError(null)
    try {
      const filtros = aplicados ?? leerFiltros()
      const filas = await exportarRechazos(filtros)
      await exportarArchivo(formato, {
        nombre: `rechazos-sendgrid-${new Date().toISOString().slice(0, 10)}`,
        titulo: 'Eventos de rechazos de SendGrid',
        detalle: describirFiltros(filtros),
        columnas: COLUMNAS_EXPORTAR,
        filas,
      })
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo exportar'))
    }
  }

  const describirFiltros = (filtros: FiltrosRechazos) => [
    filtros.nits.length === 0
      ? 'Todas las empresas'
      : filtros.nits.map((nit) => empresas.find((b) => b.nit === nit)?.nombre ?? nit).join(', '),
    filtros.estados.length > 0 && `Estados: ${filtros.estados.join(', ')}`,
    filtros.pendientes && 'deferred pendientes',
    filtros.facturas.length > 0 && `Facturas: ${filtros.facturas.join(', ')}`,
    (filtros.desde || filtros.hasta) && `Fechas: ${filtros.desde ?? '…'} a ${filtros.hasta ?? '…'}`,
  ].filter(Boolean).join(' · ')

  // Trae de SendGrid los rechazos nuevos (de las empresas elegidas, o de todas las activas) y vuelve a consultar
  const sincronizar = async () => {
    setError(null)
    setAviso(null)
    setSincronizando(true)
    try {
      const resultados = await sincronizarAuditoria(nits)
      setAviso(resultados.length === 0
        ? 'No hay bases activas para sincronizar. Configúralas en Bases.'
        : `Sincronizado: ${sumar(resultados, 'insertados')} nuevo(s), `
          + `${sumar(resultados, 'actualizados')} actualizado(s), `
          + `${sumar(resultados, 'deferredResueltos')} deferred resuelto(s).`)
      await consultar(leerFiltros(), 1)
      const fallidas = resultados.filter((r) => r.error)
      if (fallidas.length > 0) {
        setError(fallidas.map((r) => `${r.baseDatos}: ${r.error}`).join(' · '))
      }
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo sincronizar'))
    } finally {
      setSincronizando(false)
    }
  }

  const ocupado = cargando || sincronizando
  const paginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.porPagina)) : 1
  const variasEmpresas = resultado && resultado.empresas.length !== 1
  const titulo = !resultado || resultado.empresas.length === 0
    ? 'Todas las empresas'
    : resultado.empresas.length === 1
      ? resultado.empresas[0].nombre
      : `${resultado.empresas.length} empresas`

  return (
      <main className="contenido">
        <form className="busqueda" onSubmit={alEnviar}>
          <SeleccionMultiple
            id="estados"
            etiqueta="Estado"
            opciones={OPCIONES_ESTADO}
            seleccion={estados}
            onCambio={cambiarEstados}
            disabled={ocupado}
          />
          <SeleccionMultiple
            id="empresas"
            etiqueta="Empresa"
            opciones={empresas.map((b) => ({
              valor: b.nit,
              texto: `${b.nombre ?? b.baseDatos} · ${b.nit}${b.activo ? '' : ' (inactiva)'}`,
            }))}
            seleccion={nits}
            onCambio={cambiarNits}
            textoTodos="Todas las empresas"
            disabled={ocupado}
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
            <input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="hasta">Hasta</label>
            <input id="hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="acciones-form">
            <button type="submit" disabled={ocupado}>
              {cargando ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              type="button"
              className="secundario"
              onClick={sincronizar}
              disabled={ocupado}
              title="Trae de SendGrid los rechazos nuevos (de las empresas elegidas, o de todas las activas)"
            >
              {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
            </button>
            <MenuExportar onExportar={exportar} disabled={ocupado || !resultado || resultado.total === 0} />
            <button type="button" className="secundario" onClick={() => setVerBases(true)}>
              Bases
            </button>
          </div>
        </form>

        {verBases && <ModalBasesAuditoria onCerrar={cerrarBases} />}

        {sincronizando && (
          <p className="alerta alerta-info" role="status">
            Consultando SendGrid y guardando en MongoDB. Puede tardar varios minutos.
          </p>
        )}
        {aviso && <p className="alerta alerta-info" role="status">{aviso}</p>}
        {error && <p className="alerta alerta-error" role="alert">{error}</p>}

        {resultado && (
          <section>
            <p className="resumen">{titulo} · {resultado.total} rechazo(s)</p>
            <ul className="totales">
              {ESTADOS.map((e) => (
                <li key={e}>
                  <span className={`estado estado-${e}`}>{e}</span> {resultado.totales[e] ?? 0}
                </li>
              ))}
            </ul>
            {resultado.registros.length === 0 ? (
              <p className="vacio">No hay rechazos para esta búsqueda.</p>
            ) : (
              <>
                <div className="tabla-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha envío</th>
                        {variasEmpresas && <th>Empresa</th>}
                        <th>Factura</th>
                        <th>Destinatario</th>
                        <th>Estado</th>
                        <th>Tipo falla</th>
                        <th>SMTP</th>
                        <th>Respuesta</th>
                        <th>Resolución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.registros.map((r) => (
                        <tr key={r.id}>
                          <td>{fecha(r.fechaEnvio)}</td>
                          {variasEmpresas && <td>{r.razonSocial ?? r.nit}<br />{r.nit}</td>}
                          <td>{r.factura}</td>
                          <td>{r.toEmail}</td>
                          <td><span className={`estado estado-${r.estado}`}>{r.estado}</span></td>
                          <td>{r.tipoFalla}</td>
                          <td>{r.codigoSmtp}</td>
                          <td className="respuesta">
                            <span className="recortado" title={r.reason ?? undefined}>{r.reason}</span>
                          </td>
                          <td>
                            {r.estado !== 'deferred' ? '' : r.estadoResolucion ? (
                              <>
                                <span className={`estado estado-${r.estadoResolucion}`}>{r.estadoResolucion}</span>
                                <br />{fecha(r.fechaResolucion)}
                              </>
                            ) : <span className="estado estado-deferred">Pendiente</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <nav className="paginacion" aria-label="Paginación">
                  <button type="button" className="secundario" onClick={() => irAPagina(1)}
                    disabled={cargando || resultado.pagina <= 1} aria-label="Primera página">«</button>
                  <button type="button" className="secundario" onClick={() => irAPagina(resultado.pagina - 1)}
                    disabled={cargando || resultado.pagina <= 1}>Anterior</button>
                  <span>Página {resultado.pagina} de {paginas}</span>
                  <button type="button" className="secundario" onClick={() => irAPagina(resultado.pagina + 1)}
                    disabled={cargando || resultado.pagina >= paginas}>Siguiente</button>
                  <button type="button" className="secundario" onClick={() => irAPagina(paginas)}
                    disabled={cargando || resultado.pagina >= paginas} aria-label="Última página">»</button>
                </nav>
              </>
            )}
          </section>
        )}
      </main>
  )
}
