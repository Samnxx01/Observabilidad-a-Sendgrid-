import { useEffect, useRef } from 'react'

export interface Opcion {
  valor: string
  texto: string
}

interface Props {
  id: string
  etiqueta: string
  opciones: Opcion[]
  seleccion: string[]
  onCambio: (seleccion: string[]) => void
  // Texto cuando no hay nada elegido (equivale a "sin filtro")
  textoTodos?: string
  disabled?: boolean
}

// Lista desplegable con casillas para elegir varios valores de un filtro
export default function SeleccionMultiple({
  id, etiqueta, opciones, seleccion, onCambio, textoTodos = 'Todos', disabled,
}: Props) {
  const desplegable = useRef<HTMLDetailsElement>(null)

  // Se cierra al hacer clic fuera
  useEffect(() => {
    const cerrar = (evento: MouseEvent) => {
      if (desplegable.current && !desplegable.current.contains(evento.target as Node)) {
        desplegable.current.open = false
      }
    }
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [])

  const alternar = (valor: string) =>
    onCambio(seleccion.includes(valor) ? seleccion.filter((v) => v !== valor) : [...seleccion, valor])

  const resumen = seleccion.length === 0
    ? textoTodos
    : seleccion.length === 1
      ? opciones.find((o) => o.valor === seleccion[0])?.texto ?? seleccion[0]
      : `${seleccion.length} seleccionados`

  return (
    <div className="campo">
      <span className="etiqueta" id={`${id}-etiqueta`}>{etiqueta}</span>
      <details ref={desplegable} className={`multiselect${disabled ? ' deshabilitado' : ''}`}>
        <summary aria-labelledby={`${id}-etiqueta`} title={resumen}>{resumen}</summary>
        <div className="multiselect-opciones" role="group" aria-labelledby={`${id}-etiqueta`}>
          {seleccion.length > 0 && (
            <button type="button" className="enlace" onClick={() => onCambio([])} disabled={disabled}>
              Quitar selección ({textoTodos.toLowerCase()})
            </button>
          )}
          {opciones.length === 0 && <span className="vacio">Sin opciones</span>}
          {opciones.map((o) => (
            <label key={o.valor} className="campo-check">
              <input
                type="checkbox"
                checked={seleccion.includes(o.valor)}
                onChange={() => alternar(o.valor)}
                disabled={disabled}
              />
              {o.texto}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
