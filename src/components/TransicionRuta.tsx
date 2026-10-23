import { useEffect, useState } from 'react'
import CargaInicial from './CargaInicial.tsx'
// Se monta de nuevo por pathname: incluye enlaces, redirecciones y atras/adelante.
export default function TransicionRuta() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const temporizador = window.setTimeout(() => setVisible(false), reducir ? 150 : 450)
    return () => window.clearTimeout(temporizador)
  }, [])
  if (!visible) return null
  return <div className="transicion-ruta"><CargaInicial mensaje="Abriendo tu espacio" /></div>
}
