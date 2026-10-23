import { useRespuestaTiempoReal } from './useRespuestaTiempoReal.ts'
import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  consultarNotificaciones,
  obtenerEmpresasNotificaciones,
  type EmpresaNotificaciones,
  type Notificacion,
  type RespuestaNotificaciones,
} from '../api/notificaciones.ts'
import MenuExportar from './MenuExportar.tsx'
import SeleccionMultiple from './SeleccionMultiple.tsx'
import { separarValores } from '../utils/descargas.ts'
import { exportarArchivo, type Columna, type Formato } from '../utils/exportar.ts'
import { ESTADOS_NOTIFICACION } from '../utils/estados.ts'

// Maximo de facturas por consulta (lo valida tambien el backend)
const MAX_FACTURAS = 200
const FILAS_POR_PAGINA = 50

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

const fecha = (valor: string | null) => (valor ? formatoFecha.format(new Date(valor)) : '')

const ESTADOS = [
  { valor: '', texto: 'Todos' },
  { valor: '1', texto: 'Enviado' },
  { valor: '0', texto: 'Aún no enviado' },
]

const COLUMNAS_EXPORTAR: Columna<Notificacion>[] = [
  { titulo: 'Empresa', valor: (n) => n.empresa, ancho: 24 },
  { titulo: 'NIT', valor: (n) => n.nit, ancho: 12 },
  { titulo: 'Factura', valor: (n) => n.factura, ancho: 12 },
  { titulo: 'Correo', valor: (n) => n.correo, ancho: 32 },
  { titulo: 'Estado', valor: (n) => (n.enviado ? 'Enviado' : 'Aún no enviado'), ancho: 14 },
  { titulo: 'Creación (Colombia)', valor: (n) => fecha(n.fechaCreacion), ancho: 16 },
  { titulo: 'Envío (Colombia)', valor: (n) => fecha(n.fechaEnvio), ancho: 16 },
]

interface Props {
  // Valores con los que arranca el formulario, ej. al abrirlo desde otra pantalla
  nitsIniciales?: string[]
  facturasIniciales?: string[]
}

// Consulta independiente de las notificaciones por correo de facturas en SQL
// (dbo.spConsultarNotificacionesFactura via /api/notificaciones). Se puede usar en cualquier pantalla.
export default function ConsultaNotificaciones({ nitsIniciales = [], facturasIniciales = [] }: Props) {
  const id = useId()
  const [empresas, setEmpresas] = useState<EmpresaNotificaciones[]>([])
  const [nits, setNits] = useState<string[]>(nitsIniciales)
  const [facturas, setFacturas] = useState(facturasIniciales.join(', '))
  const [estado, setEstado] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [orden, setOrden] = useState<'ASC' | 'DESC'>('DESC')
  const [resultado, setResultado] = useState<RespuestaNotificaciones | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pagina, setPagina] = useState(1)
  useRespuestaTiempoReal<RespuestaNotificaciones>('/notificaciones/facturas', setResultado)

  useEffect(() => {
    obtenerEmpresasNotificaciones()
      .then(setEmpresas)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las empresas'))
  }, [])

  const lista = separarValores(facturas.toUpperCase())
  // Facturas o estado: "Todos" sin facturas recorreria todas las notificaciones de la base
  const rangoValido = Boolean(desde && hasta && desde <= hasta && Date.parse(hasta) - Date.parse(desde) < 365 * 86400000)
  const puedeConsultar = nits.length > 0 && (lista.length > 0 || estado !== '') && rangoValido

  const buscar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)
    if (!rangoValido) {
      setError('Indica desde y hasta en orden, con un rango de hasta 365 días incluyendo ambas fechas.')
      return
    }
    if (lista.length > MAX_FACTURAS) {
      setError(`Máximo ${MAX_FACTURAS} facturas por consulta (escribiste ${lista.length})`)
      return
    }
    setCargando(true)
    setPagina(1)
    try {
      setResultado(await consultarNotificaciones({
        nits,
        facturas: lista,
        desde,
        hasta,
        orden,
        status: estado === '' ? null : (Number(estado) as 0 | 1),
      }))
    } catch (err) {
      setResultado(null)
      setError(err instanceof Error ? err.message : 'No se pudo consultar')
    } finally {
      setCargando(false)
    }
  }

  // Filtro local: no modifica la respuesta ni dispara nuevas peticiones.
  const obtenidas = resultado?.notificaciones ?? []
  const notificaciones = lista.length === 0 ? obtenidas : obtenidas.filter(n =>
    lista.some(filtro => n.factura.toUpperCase().includes(filtro)))
  const totalPaginas = Math.max(1, Math.ceil(notificaciones.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaActual - 1) * FILAS_POR_PAGINA
  const filasPagina = notificaciones.slice(inicioPagina, inicioPagina + FILAS_POR_PAGINA)
  const varias = (resultado?.empresas.length ?? 0) > 1
  // Si el SP fallo en una base no se sabe si sus facturas tienen notificaciones
  const conError = resultado?.errores.length ?? 0
  const respondieron = (resultado?.empresas.length ?? 0) - conError
  const conNotificaciones = new Set(obtenidas.map((n) => n.factura.toUpperCase()))
  const sinNotificaciones = resultado?.facturas.filter((f) => !conNotificaciones.has(f)) ?? []
  const enviadas = notificaciones.filter((n) => n.enviado).length

  const exportar = async (formato: Formato) => {
    setError(null)
    try {
      await exportarArchivo(formato, {
        nombre: `notificaciones-facturas-${new Date().toISOString().slice(0, 10)}`,
        titulo: 'Notificaciones de facturas - Vie',
        detalle: [
          resultado?.empresas.map((e) => `${e.nombre} (${e.nit})`).join(', '),
          `Estado: ${ESTADOS.find((e) => e.valor === estado)?.texto}`,
          resultado && `Orden: ${resultado.orden === 'ASC' ? 'Ascendente' : 'Descendente'}`,
          resultado && `Creación: ${resultado.desde} a ${resultado.hasta} (Colombia)`,
          lista.length > 0 && `Filtro local de facturas: ${lista.join(', ')}`,
          sinNotificaciones.length > 0 && `Sin notificaciones: ${sinNotificaciones.join(', ')}`,
        ].filter(Boolean).join(' · '),
        columnas: COLUMNAS_EXPORTAR,
        filas: notificaciones,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar')
    }
  }

  return (
    <section className="consulta-notificaciones">
      <form className="busqueda" onSubmit={buscar}>
        <SeleccionMultiple
          id={`${id}-empresas`}
          etiqueta="Empresas"
          opciones={empresas.map((e) => ({ valor: e.nit, texto: `${e.nombre} · ${e.nit}` }))}
          seleccion={nits}
          onCambio={setNits}
          textoTodos="Selecciona…"
        />
        <div className="campo">
          <label htmlFor={`${id}-facturas`}>Facturas (opcional)</label>
          <input
            id={`${id}-facturas`}
            value={facturas}
            onChange={(e) => { setFacturas(e.target.value); setPagina(1) }}
            placeholder="CS307738, QC231168"
            aria-describedby={resultado ? `${id}-filtro-facturas-ayuda` : undefined}
            title="Varias facturas separadas por coma, punto y coma o espacio"
          />
        </div>
        {resultado && <p id={`${id}-filtro-facturas-ayuda`} className="ayuda" role="status">
          Mostrando {notificaciones.length} de {obtenidas.length} notificaciones cargadas.
          {' '}Escribe una factura completa o parcial para filtrar al instante; separa varias con coma.
          {lista.length > 0 && <button type="button" className="enlace-filtro" onClick={() => { setFacturas(''); setPagina(1) }}>Ver todas las cargadas</button>}
        </p>}
        <div className="campo">
          <label htmlFor={`${id}-estado`}>Estado</label>
          <select id={`${id}-estado`} value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${id}-desde`}>Desde (creación)</label>
          <input id={`${id}-desde`} type="date" required min="1753-01-01" max={hasta || '9999-12-30'} value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-hasta`}>Hasta (creación)</label>
          <input id={`${id}-hasta`} type="date" required min={desde || '1753-01-01'} max="9999-12-30" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <p className="ayuda">Fechas obligatorias, hora Colombia. Máximo 365 días incluyendo ambas fechas.</p>
        <div className="campo">
          <label htmlFor={`${id}-orden`}>Orden por fecha de creación</label>
          <select id={`${id}-orden`} value={orden} onChange={e => setOrden(e.target.value as 'ASC' | 'DESC')}>
            <option value="DESC">Descendente (más recientes primero)</option>
            <option value="ASC">Ascendente (más antiguas primero)</option>
          </select>
        </div>
        <div className="acciones-form">
          <button
            type="submit"
            disabled={cargando || !puedeConsultar}
            title={puedeConsultar ? undefined : 'Elige una empresa, facturas o estado, y un rango de fechas de hasta 365 días'}
          >
            {cargando ? 'Consultando…' : 'Consultar'}
          </button>
          <MenuExportar onExportar={exportar} disabled={notificaciones.length === 0} />
        </div>
      </form>

      {desde && hasta && !rangoValido && <p className="alerta alerta-error" role="alert">El rango debe estar ordenado y no superar 365 días incluyendo ambas fechas.</p>}
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}

      {resultado?.errores.map((e) => (
        <p key={e.baseDatos} className="alerta alerta-error" role="alert">
          {e.baseDatos} ({e.nit}): {e.error}
        </p>
      ))}

      {resultado && respondieron > 0 && (
        <>
          <p className="resumen">
            {notificaciones.length} notificación(es) · {enviadas} enviada(s) · {notificaciones.length - enviadas} sin enviar
            {resultado.facturas.length > 0 && (
              <span className={`insignia ${sinNotificaciones.length ? 'insignia-alerta' : 'insignia-ok'}`}>
                {sinNotificaciones.length ? '⚠' : '✓'} {resultado.facturas.length - sinNotificaciones.length} de {resultado.facturas.length}
                {' '}factura(s) con notificaciones
              </span>
            )}
          </p>

          {resultado.truncadas.length > 0 && (
            <p className="alerta alerta-info" role="status">
              Se muestran las {resultado.maxPorBase} notificaciones {resultado.orden === 'ASC' ? 'más antiguas' : 'más recientes'} por empresa
              {varias && ` (${resultado.truncadas.join(', ')})`}; puede haber más. El filtro local solo busca entre las filas cargadas; pulsa Consultar para buscar la factura en la base.
            </p>
          )}

          {sinNotificaciones.length > 0 && (
            <details className="no-encontradas">
              <summary>Ver facturas sin notificaciones ({sinNotificaciones.length})</summary>
              <p>
                No tienen notificaciones{estado !== '' && ' con el estado elegido'} en las empresas
                {conError > 0 ? ' que respondieron (las que fallaron no se pudieron revisar)' : ' seleccionadas'}:
              </p>
              <ul>
                {sinNotificaciones.map((f) => <li key={f}><code>{f}</code></li>)}
              </ul>
            </details>
          )}

          {notificaciones.length === 0 ? (
            <p className="vacio">{lista.length > 0 ? 'No hay coincidencias con esas facturas en los resultados cargados.' : 'No hay notificaciones para esta búsqueda.'}</p>
          ) : (
            <>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    {varias && <th>Empresa</th>}
                    <th>Factura</th>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Creación</th>
                    <th>Envío</th>
                  </tr>
                </thead>
                <tbody>
                  {filasPagina.map((n) => (
                    <tr key={`${n.nit}-${n.id}`}>
                      {varias && <td>{n.empresa}<br />{n.nit}</td>}
                      <td>{n.factura}</td>
                      <td>{n.correo}</td>
                      <td>
                        <span
                          className={`estado ${n.enviado ? 'estado-delivered' : 'estado-deferred'}`}
                          title={ESTADOS_NOTIFICACION[n.enviado ? 0 : 1].texto}
                        >
                          {n.enviado ? 'Enviado' : 'Aún no enviado'}
                        </span>
                      </td>
                      <td>{fecha(n.fechaCreacion)}</td>
                      <td>{fecha(n.fechaEnvio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="paginacion" aria-label="Paginación de notificaciones">
              <span role="status">{inicioPagina + 1}-{Math.min(inicioPagina + FILAS_POR_PAGINA, notificaciones.length)} de {notificaciones.length} registros</span>
              <button type="button" className="secundario" disabled={paginaActual === 1 || cargando} onClick={() => setPagina(1)} aria-label="Primera página">Primera</button>
              <button type="button" className="secundario" disabled={paginaActual === 1 || cargando} onClick={() => setPagina(paginaActual - 1)}>Anterior</button>
              <span>Página {paginaActual} de {totalPaginas} ? 50 registros por página</span>
              <button type="button" className="secundario" disabled={paginaActual === totalPaginas || cargando} onClick={() => setPagina(paginaActual + 1)}>Siguiente</button>
              <button type="button" className="secundario" disabled={paginaActual === totalPaginas || cargando} onClick={() => setPagina(totalPaginas)} aria-label="Última página">Última</button>
            </nav>
            </>
          )}
        </>
      )}
    </section>
  )
}
