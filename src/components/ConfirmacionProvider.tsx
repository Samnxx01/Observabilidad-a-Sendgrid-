import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmacionContext } from './useConfirmar.ts'
export default function ConfirmacionProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null)
  const resolver = useRef<((valor: boolean) => void) | null>(null)
  const dialogo = useRef<HTMLDialogElement>(null)
  const id = useId()
  const confirmar = useCallback((texto: string) => {
    if (resolver.current) return Promise.resolve(false)
    return new Promise<boolean>(resolve => { resolver.current = resolve; setMensaje(texto) })
  }, [])
  const responder = (valor: boolean) => {
    const terminar = resolver.current
    resolver.current = null
    dialogo.current?.close()
    setMensaje(null)
    terminar?.(valor)
  }
  useEffect(() => {
    if (mensaje !== null && dialogo.current && !dialogo.current.open) dialogo.current.showModal()
  }, [mensaje])
  useEffect(() => () => { resolver.current?.(false); resolver.current = null }, [])
  return (
    <ConfirmacionContext value={confirmar}>
      {children}
      {mensaje !== null && createPortal(
        <dialog ref={dialogo} className="modal modal-confirmacion" aria-labelledby={id + '-titulo'} aria-describedby={id + '-mensaje'}
          onCancel={evento => { evento.preventDefault(); responder(false) }}
          onClose={() => { if (resolver.current) responder(false) }}>
          <div className="modal-cabecera"><h2 id={id + '-titulo'}>Confirmar acción</h2></div>
          <p id={id + '-mensaje'} className="confirmacion-mensaje">{mensaje}</p>
          <div className="confirmacion-acciones">
            <button type="button" className="secundario" autoFocus onClick={() => responder(false)}>Cancelar</button>
            <button type="button" onClick={() => responder(true)}>Confirmar</button>
          </div>
        </dialog>, document.body)}
    </ConfirmacionContext>
  )
}
