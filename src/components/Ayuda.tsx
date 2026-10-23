import { useEffect, useRef, type ReactNode } from 'react'
import type { DescripcionEstado } from '../utils/estados.ts'

interface Props {
  titulo: string
  children: ReactNode
}

// Boton "?" que abre un panel de ayuda. Se cierra con clic fuera o con Esc.
export default function Ayuda({ titulo, children }: Props) {
  const panel = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const cerrar = (evento: MouseEvent | KeyboardEvent) => {
      const detalles = panel.current
      if (!detalles?.open) return
      if (evento instanceof KeyboardEvent ? evento.key === 'Escape' : !detalles.contains(evento.target as Node)) {
        detalles.open = false
      }
    }
    document.addEventListener('click', cerrar)
    document.addEventListener('keydown', cerrar)
    return () => {
      document.removeEventListener('click', cerrar)
      document.removeEventListener('keydown', cerrar)
    }
  }, [])

  return (
    <details ref={panel} className="boton-ayuda">
      <summary aria-label={`Ayuda: ${titulo}`} title={`Ayuda: ${titulo}`}>?</summary>
      <div className="panel-ayuda" role="note">
        <strong className="panel-ayuda-titulo">{titulo}</strong>
        {children}
      </div>
    </details>
  )
}

// Lista de estados con su color y explicacion, para usar dentro de <Ayuda>
export function ListaEstados({ estados }: { estados: DescripcionEstado[] }) {
  return (
    <dl className="lista-estados">
      {estados.map((e) => (
        <div key={e.estado}>
          <dt><span className={`estado ${e.clase}`}>{e.estado}</span></dt>
          <dd>{e.texto}</dd>
        </div>
      ))}
    </dl>
  )
}
