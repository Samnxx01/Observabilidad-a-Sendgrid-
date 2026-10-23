import { useCallback, useEffect, useRef, useState } from 'react'
import { escucharToast, type AvisoToast } from '../utils/toast.ts'
const TITULOS = { exito: 'Correcto', error: 'Error', aviso: 'Atención', info: 'Información' }
function Toast({ aviso, cerrar }: { aviso: AvisoToast; cerrar: (id: number) => void }) {
  const [pausado, setPausado] = useState(false)
  useEffect(() => {
    if (pausado) return
    const timer = window.setTimeout(() => cerrar(aviso.id), aviso.tipo === 'error' ? 10000 : 6000)
    return () => window.clearTimeout(timer)
  }, [aviso.id, aviso.tipo, cerrar, pausado])
  return <div className={`toast toast-${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}
    onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)} onFocus={() => setPausado(true)} onBlur={() => setPausado(false)}>
    <div><strong>{TITULOS[aviso.tipo]}</strong><p>{aviso.mensaje}</p></div>
    <button type="button" className="secundario" aria-label="Cerrar notificación" onClick={() => cerrar(aviso.id)}>×</button>
  </div>
}
export default function ToastNotificaciones() {
  const [avisos, setAvisos] = useState<AvisoToast[]>([])
  const contenedor = useRef<HTMLDivElement>(null)
  useEffect(() => escucharToast(aviso => setAvisos(actuales => [...actuales.slice(-4), aviso])), [])
  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo || avisos.length === 0) return
    // Popover manual conserva los avisos visibles sobre los dialogos de la aplicacion.
    nodo.hidePopover?.()
    nodo.showPopover?.()
  }, [avisos])
  const cerrar = useCallback((id: number) => setAvisos(actuales => actuales.filter(aviso => aviso.id !== id)), [])
  return <div ref={contenedor} popover="manual" className="toast-contenedor" aria-label="Notificaciones">
    {avisos.map(aviso => <Toast key={aviso.id} aviso={aviso} cerrar={cerrar} />)}
  </div>
}
