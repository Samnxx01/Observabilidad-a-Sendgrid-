import { useState } from 'react'
import { AyudaDropped } from '../components/AyudasEstados.tsx'
import ConsultaDropped from '../components/ConsultaDropped.tsx'
import TrazabilidadDestinatario from '../components/TrazabilidadDestinatario.tsx'

// Pantalla de envios dropped (ruta dinamica, componente Dropped).
// La consulta a SendGrid vive en los componentes independientes ConsultaDropped y TrazabilidadDestinatario.
export default function Dropped() {
  // Correo elegido desde la tabla de dropped; la version cambia la key para volver a consultar
  const [traza, setTraza] = useState({ correo: '', version: 0 })

  return (
    <main className="contenido">
      <div className="titulo-con-ayuda">
        <h1>Supresiones actuales de SendGrid</h1>
        <AyudaDropped />
      </div>
      <ConsultaDropped onVerTrazabilidad={(correo) => setTraza((t) => ({ correo, version: t.version + 1 }))} />

      <h2>Trazabilidad del destinatario</h2>
      <p className="ayuda">
        Si el correo está hoy en una lista de supresión y cómo terminaron sus envíos día a día: útil para confirmar,
        después de quitarlo de la supresión, si ya se entrega, sigue rechazado por el buzón o volvió a la lista.
      </p>
      <TrazabilidadDestinatario key={traza.version} correoInicial={traza.correo} />
    </main>
  )
}
