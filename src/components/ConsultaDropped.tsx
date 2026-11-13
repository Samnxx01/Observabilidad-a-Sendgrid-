import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api/cliente.ts'
import { useAuth } from '../auth/useAuth.ts'
import MenuExportar from './MenuExportar.tsx'
import { exportarArchivo, type Formato } from '../utils/exportar.ts'
import ModalQuitarSupresion, { type AccionSupresion } from './ModalQuitarSupresion.tsx'
interface Registro { email: string; lista: string; motivo: string; fecha: string | null }
interface Resultado { registros: Registro[]; incompleto: boolean; consultadoEn: string; listas: string[] }
interface Props { destinatariosIniciales?: string[]; onVerTrazabilidad?: (correo: string) => void }
const nombres: Record<string, string> = { bounces: 'Bounces', blocks: 'Blocks', invalid_emails: 'Invalid emails', spam_reports: 'Spam reports' }
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : 'Sin fecha'
export default function ConsultaDropped({ destinatariosIniciales = [], onVerTrazabilidad }: Props) {
 const { usuario } = useAuth()
 const puedeQuitar = usuario?.acciones?.includes('supresiones.administrar')
 const [filtro, setFiltro] = useState(destinatariosIniciales.join(', '))
 const [lista, setLista] = useState('')
 const [resultado, setResultado] = useState<Resultado | null>(null)
 const [error, setError] = useState('')
 const [aviso, setAviso] = useState('')
 const [ocupado, setOcupado] = useState(false)
 const [pagina, setPagina] = useState(1)
 const [modal, setModal] = useState<AccionSupresion | null>(null)
 const consulta = useRef<AbortController | null>(null)
 useEffect(() => () => consulta.current?.abort(), [])
 const buscar = async (evento?: FormEvent) => {
  evento?.preventDefault()
  if (consulta.current) return
  const control = new AbortController()
  consulta.current = control
  setOcupado(true); setError(''); setAviso(''); setResultado(null); setPagina(1)
  try {
   const datos = await api<Resultado>('/dropped/consultar', { method: 'POST', signal: control.signal, notificar: false,
    body: JSON.stringify({ destinatarios: filtro.split(/[\s,;]+/).filter(Boolean) }) })
   if (!control.signal.aborted) setResultado(datos)
  } catch (err) { if (!control.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo consultar.') }
  finally { if (consulta.current === control) { consulta.current = null; setOcupado(false) } }
 }
 const registros = resultado?.registros.filter(r => !lista || r.lista === lista) ?? []
 const paginas = Math.max(1, Math.ceil(registros.length / 50))
 const exportar = async (formato: Formato) => {
  try {
   await exportarArchivo(formato, { nombre: 'supresiones-actuales', titulo: 'Destinatarios actualmente en supresion',
    detalle: 'Consulta: ' + fecha(resultado?.consultadoEn ?? null) + '. Filtro: ' + (filtro || 'Todos los destinatarios de SendGrid'),
    columnas: [
     { titulo: 'Destinatario', valor: (r: Registro) => r.email, ancho: 35 },
     { titulo: 'Lista actual', valor: (r: Registro) => nombres[r.lista], ancho: 20 },
     { titulo: 'Motivo', valor: (r: Registro) => r.motivo, ancho: 50 },
     { titulo: 'Registro (Colombia)', valor: (r: Registro) => fecha(r.fecha), ancho: 22 },
    ], filas: registros })
  } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo exportar.') }
 }
 const destinatarios = [...new Set(registros.filter(r => r.lista === modal).map(r => r.email))]
  .map(to_email => ({ to_email, envios: 0, listaMotivos: [] }))
 return <>
 <p>Destinatarios que siguen registrados en Bounces, Blocks, Invalid emails o Spam reports. La tabla consulta el estado actual; la trazabilidad inferior conserva el historial de envios.</p>
 <form className="busqueda" onSubmit={buscar}>
 <div className="campo"><label htmlFor="sup-filtro">Dominios o correos</label>
 <input id="sup-filtro" disabled={ocupado} value={filtro} onChange={e => { setFiltro(e.target.value); setResultado(null) }} placeholder="dominio.com, usuario@otro.com" /></div>
 <div className="campo"><label htmlFor="sup-lista">Lista actual</label><select id="sup-lista" value={lista} onChange={e => { setLista(e.target.value); setPagina(1) }}>
 <option value="">Todas</option>{Object.entries(nombres).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}</select></div>
 <div className="acciones-form"><button disabled={ocupado} type="submit">{ocupado ? 'Consultando...' : 'Buscar actuales'}</button>
 {ocupado && <button type="button" onClick={() => { consulta.current?.abort(); setAviso('Consulta cancelada.') }}>Cancelar consulta</button>}
 <MenuExportar disabled={!registros.length || ocupado} onExportar={exportar} />
 {puedeQuitar && (['bounces', 'blocks', 'invalid_emails'] as const).map(accion => <button key={accion} type="button" disabled={ocupado || !registros.some(r => r.lista === accion)} onClick={() => setModal(accion)}>Quitar de {nombres[accion]}</button>)}
 </div></form>
 <p className="ayuda">Los datos se consultan directamente en SendGrid. Escribe dominios o correos para filtrar; vacio consulta todos los destinatarios. No incluye bajas de suscripcion.</p>
 {error && <p className="alerta alerta-error" role="alert">{error}</p>}
 {aviso && <p role="status">{aviso}</p>}
 {resultado && <section><p>{registros.length} registro(s) actuales. Consultado: {fecha(resultado.consultadoEn)}.</p>
 {resultado.incompleto && <p role="alert">Resultado incompleto: se alcanzo el limite de consulta. Puede haber mas destinatarios.</p>}
 <div className="tabla-contenedor"><table><thead><tr><th>Destinatario</th><th>Lista actual</th><th>Motivo</th><th>Fecha del registro</th><th>Acciones</th></tr></thead>
 <tbody>{registros.slice((pagina - 1) * 50, pagina * 50).map((r, i) => <tr key={r.lista + r.email + i}><td>{r.email}</td><td>{nombres[r.lista]}</td><td>{r.motivo}</td><td>{fecha(r.fecha)}</td>
 <td>{onVerTrazabilidad && <button type="button" onClick={() => onVerTrazabilidad(r.email)}>Ver trazabilidad</button>}</td></tr>)}</tbody></table></div>
 {!registros.length && <p>No hay destinatarios en estas listas para el filtro consultado.</p>}
 {paginas > 1 && <nav className="paginacion"><button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>{pagina} de {paginas}</span><button disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button></nav>}
 </section>}
 {modal && <ModalQuitarSupresion accion={modal} destinatarios={destinatarios} quitados={new Set()} onQuitados={() => { setModal(null); void buscar() }} onCerrar={() => setModal(null)} />}
 </>
}
