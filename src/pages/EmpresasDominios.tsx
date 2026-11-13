import { useEffect, useState, type FormEvent } from 'react'
import { listarEmpresasDominios, guardarEmpresaDominio, eliminarEmpresaDominio, type EmpresaDominio } from '../api/empresasDominios.ts'
import { useAuth } from '../auth/useAuth.ts'
import { useConfirmar } from '../components/useConfirmar.ts'
export default function EmpresasDominios() {
 const { usuario } = useAuth()
 const permitido = usuario?.acciones?.includes('empresas.dominios.administrar')
 const confirmar = useConfirmar()
 const [empresas, setEmpresas] = useState<EmpresaDominio[]>([])
 const [nit, setNit] = useState('')
 const [nombre, setNombre] = useState('')
 const [dominios, setDominios] = useState('')
 const [editando, setEditando] = useState(false)
 const [ocupado, setOcupado] = useState(false)
 const [error, setError] = useState('')
 const cargar = async () => setEmpresas((await listarEmpresasDominios()).empresas)
 useEffect(() => { if (permitido) listarEmpresasDominios().then(r => setEmpresas(r.empresas)).catch(e => setError(e.message)) }, [permitido])
 const limpiar = () => { setNit(''); setNombre(''); setDominios(''); setEditando(false) }
 const guardar = async (e: FormEvent) => {
  e.preventDefault(); if (ocupado) return
  setOcupado(true); setError('')
  try { await guardarEmpresaDominio({ nit, nombre, dominios: dominios.split(/[\s,;]+/).filter(Boolean).map(d => d.toLowerCase()) }, editando); limpiar(); await cargar() }
  catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
  finally { setOcupado(false) }
 }
 const eliminar = async (empresa: EmpresaDominio) => {
  if (ocupado || !await confirmar(`¿Eliminar la relacion de dominios de ${empresa.nombre}?`)) return
  setOcupado(true); setError('')
  try { await eliminarEmpresaDominio(empresa.nit); if (nit === empresa.nit) limpiar(); await cargar() }
  catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar') }
  finally { setOcupado(false) }
 }
 return <main className="contenido"><h1>Empresas y dominios</h1>
 {!permitido ? <p role="alert">Tu rol necesita el permiso Administrar empresas y dominios.</p> : <>
 <p>Relaciona la empresa destinataria con sus dominios de correo. Usa dominios exactos, sin @. Registra los subdominios por separado.</p>
 <p className="ayuda">Los dominios compartidos como gmail.com no identifican una empresa. Un dominio puede pertenecer a varias empresas; la coincidencia no identifica al emisor de la factura.</p>
 {error && <p className="alerta alerta-error" role="alert">{error}</p>}
 <form className="busqueda" onSubmit={guardar}><fieldset disabled={ocupado}>
 <legend>{editando ? 'Editar empresa' : 'Agregar empresa'}</legend>
 <div className="campo"><label htmlFor="dom-nit">NIT</label><select id="dom-nit" required disabled={editando} value={nit} onChange={e => { const empresa = empresas.find(item => item.nit === e.target.value); setNit(e.target.value); setNombre(empresa?.nombre ?? ''); setDominios(empresa?.dominios.join(', ') ?? ''); setEditando(!!empresa?.dominios.length) }}>
<option value="">Seleccione un contenedor parametrizado</option>{empresas.map(empresa => <option key={empresa.nit} value={empresa.nit}>{empresa.nombre} · {empresa.nit}</option>)}</select></div>
 <div className="campo"><label htmlFor="dom-nombre">Empresa</label><input id="dom-nombre" readOnly required maxLength={160} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
 <div className="campo"><label htmlFor="dom-lista">Dominios separados por coma</label><textarea id="dom-lista" required value={dominios} onChange={e => setDominios(e.target.value)} placeholder="empresa.com, facturacion.empresa.com" /></div>
 <button type="submit">Guardar</button><button type="button" onClick={limpiar}>Cancelar</button>
 </fieldset></form>
 <table><thead><tr><th>NIT</th><th>Empresa</th><th>Dominios</th><th>Acciones</th></tr></thead><tbody>{empresas.map(empresa => <tr key={empresa.nit}>
 <td>{empresa.nit}</td><td>{empresa.nombre}</td><td>{empresa.dominios.join(', ')}</td><td>
 <button disabled={ocupado} onClick={() => { setNit(empresa.nit); setNombre(empresa.nombre); setDominios(empresa.dominios.join(', ')); setEditando(true) }}>Editar</button>
 <button disabled={ocupado} onClick={() => void eliminar(empresa)}>Eliminar</button></td></tr>)}</tbody></table>
 {empresas.length === 0 && <p>No hay empresas registradas.</p>}
 </>}
 </main>
}
