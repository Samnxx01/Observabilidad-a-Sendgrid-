import { useRef, useState } from 'react'
import type { Formato } from '../utils/exportar.ts'

interface Props {
  onExportar: (formato: Formato) => Promise<void>
  disabled?: boolean
}

// Boton "Exportar" con opciones Excel y PDF
export default function MenuExportar({ onExportar, disabled }: Props) {
  const menu = useRef<HTMLDetailsElement>(null)
  const [exportando, setExportando] = useState<Formato | null>(null)

  const elegir = async (formato: Formato) => {
    if (menu.current) {
      menu.current.open = false
    }
    setExportando(formato)
    try {
      await onExportar(formato)
    } finally {
      setExportando(null)
    }
  }

  const bloqueado = disabled || exportando !== null

  return (
    <details ref={menu} className={`menu-exportar${bloqueado ? ' deshabilitado' : ''}`}
      onBlur={(e) => {
        if (menu.current && !menu.current.contains(e.relatedTarget as Node)) {
          menu.current.open = false
        }
      }}
    >
      <summary className="boton-secundario" title="Descarga todos los registros de la búsqueda">
        {exportando ? `Exportando ${exportando === 'excel' ? 'Excel' : 'PDF'}…` : 'Exportar ▾'}
      </summary>
      <div className="menu-exportar-opciones" role="menu">
        <button type="button" role="menuitem" className="secundario" onClick={() => elegir('excel')}>
          Excel (.xlsx)
        </button>
        <button type="button" role="menuitem" className="secundario" onClick={() => elegir('pdf')}>
          PDF
        </button>
      </div>
    </details>
  )
}
