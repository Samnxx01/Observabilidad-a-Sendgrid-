import Ayuda, { ListaEstados } from './Ayuda.tsx'
import {
  ESTADOS_NOTIFICACION,
  ESTADOS_SEGUIMIENTO,
  ESTADOS_SENDGRID,
  ESTADOS_SERVICIO,
  TIPOS_FALLA,
} from '../utils/estados.ts'

// Ayuda de cada pantalla: que hace el proceso y que significa cada estado

export function AyudaFacturas() {
  return (
    <Ayuda titulo="Envíos de facturas en SendGrid">
      <p>
        Busca en SendGrid los correos de factura electrónica de las empresas elegidas (últimos 30 días).
        Cada fila es un envío a un destinatario; una factura puede tener varios.
      </p>
      <ListaEstados estados={ESTADOS_SENDGRID} />
      <p>La columna <em>Respuesta</em> es lo que contestó el servidor del destinatario (código SMTP y motivo).</p>
    </Ayuda>
  )
}

export function AyudaAuditoria() {
  return (
    <Ayuda titulo="Eventos de rechazos">
      <p>
        Rechazos de SendGrid guardados en la auditoría (MongoDB). La sincronización trae de SendGrid los
        correos de cada empresa que no se entregaron y el watcher la repite según la programación.
      </p>
      <h4>Estado en SendGrid</h4>
      <ListaEstados estados={ESTADOS_SENDGRID.filter((e) => ['deferred', 'bounced', 'blocked', 'dropped'].includes(e.estado))} />
      <h4>Tipo de falla</h4>
      <ListaEstados estados={TIPOS_FALLA} />
      <h4>Seguimiento</h4>
      <ListaEstados estados={ESTADOS_SEGUIMIENTO} />
      <p>El filtro <em>deferred pendientes</em> muestra los rechazos temporales que todavía no se resuelven.</p>
    </Ayuda>
  )
}

export function AyudaNotificaciones() {
  return (
    <Ayuda titulo="Notificaciones de facturas">
      <p>
        Consulta en la base SQL de cada empresa los correos que el sistema de facturación programó para
        cada documento electrónico (dbo.spConsultarNotificacionesFactura). Escribe facturas, elige un estado o ambos.
      </p>
      <ListaEstados estados={ESTADOS_NOTIFICACION} />
      <p>
        Sin facturas se muestran las 500 notificaciones más recientes del estado elegido por empresa.
        <em> Creación</em> es cuando se generó la notificación y <em>Envío</em> cuando salió el correo.
      </p>
    </Ayuda>
  )
}

export function AyudaServicios() {
  return (
    <Ayuda titulo="Estado de servicios">
      <p>Muestra si el backend puede usar cada servicio externo y cómo van sus procesos automáticos.</p>
      <ListaEstados estados={ESTADOS_SERVICIO} />
    </Ayuda>
  )
}
