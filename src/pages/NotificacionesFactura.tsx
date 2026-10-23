import { AyudaNotificaciones } from '../components/AyudasEstados.tsx'
import ConsultaNotificaciones from '../components/ConsultaNotificaciones.tsx'

// Pantalla de notificaciones de facturas (ruta dinamica, componente NotificacionesFactura).
// La consulta al SP vive en el componente independiente ConsultaNotificaciones.
export default function NotificacionesFactura() {
  return (
    <main className="contenido">
      <div className="titulo-con-ayuda">
        <h1>Notificaciones de facturas - Vie</h1>
        <AyudaNotificaciones />
      </div>
      <ConsultaNotificaciones />
    </main>
  )
}
