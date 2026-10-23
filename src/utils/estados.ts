// Explicacion de los estados que muestra la aplicacion. Se usan en los botones de ayuda
// (components/AyudasEstados.tsx) y como tooltip de cada estado en las tablas.

export interface DescripcionEstado {
  estado: string
  texto: string
  // Clase CSS del color del estado (estado-delivered = verde, estado-deferred = amarillo, estado-bounced = rojo)
  clase: string
}

// Estados de un correo en SendGrid (pantallas Facturas y Eventos de rechazos)
export const ESTADOS_SENDGRID: DescripcionEstado[] = [
  { estado: 'processed', clase: 'estado-processed', texto: 'SendGrid recibió el correo y lo está procesando; todavía no hay respuesta del servidor del destinatario.' },
  { estado: 'delivered', clase: 'estado-delivered', texto: 'Entregado: el servidor de correo del destinatario lo aceptó.' },
  { estado: 'deferred', clase: 'estado-deferred', texto: 'Rechazo temporal (servidor caído, lento o buzón ocupado). SendGrid reintenta solo hasta 72 h y termina en delivered, bounced o dropped.' },
  { estado: 'bounced', clase: 'estado-bounced', texto: 'Rechazo permanente, ej. la cuenta no existe (550 5.1.1). No se reintenta y la dirección queda suprimida: los siguientes envíos a ella saldrán dropped.' },
  { estado: 'blocked', clase: 'estado-blocked', texto: 'El servidor del destinatario lo rechazó (buzón lleno, políticas, filtro de spam). No se reintenta, pero la dirección no queda suprimida: los siguientes envíos sí se intentan.' },
  { estado: 'dropped', clase: 'estado-dropped', texto: 'SendGrid no lo envió porque la dirección está en una lista de supresión (rebotó antes, se dio de baja o reportó spam).' },
]

// Tipo de falla que guarda la auditoria para cada rechazo
export const TIPOS_FALLA: DescripcionEstado[] = [
  { estado: 'TEMPORAL', clase: 'estado-deferred', texto: 'deferred: SendGrid sigue reintentando; todavía no es definitivo.' },
  { estado: 'PERMANENTE', clase: 'estado-bounced', texto: 'bounced: el correo no se entregará; hay que corregir la dirección.' },
  { estado: 'BLOQUEO', clase: 'estado-blocked', texto: 'blocked: el destinatario lo rechazó; revisar el motivo en la respuesta SMTP.' },
  { estado: 'SUPRIMIDO', clase: 'estado-dropped', texto: 'dropped: SendGrid no lo envió; hay que sacar la dirección de la lista de supresión o cambiarla.' },
]

// Resolucion de un deferred y envio a New Relic (Eventos de rechazos)
export const ESTADOS_SEGUIMIENTO: DescripcionEstado[] = [
  { estado: 'Pendiente', clase: 'estado-deferred', texto: 'Resolución de un deferred: aún no se sabe en qué terminó. La sincronización lo vuelve a revisar en SendGrid.' },
  { estado: 'delivered / bounced / dropped', clase: 'estado-delivered', texto: 'Resolución de un deferred: el estado final que tuvo en SendGrid y la fecha en que se detectó.' },
  { estado: 'New Relic enviado', clase: 'estado-delivered', texto: 'El rechazo ya está en New Relic como evento SendgridRechazo.' },
  { estado: 'New Relic omitido', clase: 'estado-processed', texto: 'No se envió porque ese destinatario ya tiene un evento con el mismo estado (un evento por destinatario y estado).' },
  { estado: 'New Relic pendiente', clase: 'estado-deferred', texto: 'Aún no se envía; sale en la siguiente sincronización o con "Enviar a New Relic".' },
]

// Estado de una notificacion por correo en SQL (Billing.ElectronicDocumentNotification.Status)
export const ESTADOS_NOTIFICACION: DescripcionEstado[] = [
  { estado: 'Enviado (1)', clase: 'estado-delivered', texto: 'El sistema de facturación ya envió el correo (fecha en "Envío"). Que se haya enviado no garantiza que se entregara: eso se ve en Facturas (SendGrid).' },
  { estado: 'Aún no enviado (0)', clase: 'estado-deferred', texto: 'La notificación está creada pero el correo todavía no sale del sistema de facturación.' },
]

// Estados de la pantalla Estado de servicios
export const ESTADOS_SERVICIO: DescripcionEstado[] = [
  { estado: 'Disponible / Configurado', clase: 'estado-delivered', texto: 'El servicio responde o tiene todo lo necesario configurado.' },
  { estado: 'En curso / Programado', clase: 'estado-processed', texto: 'Un proceso (watcher, limpieza) se está ejecutando o tiene una próxima ejecución programada.' },
  { estado: 'Conectando / Desconectando', clase: 'estado-processed', texto: 'La conexión está cambiando de estado; vuelve a consultar en unos segundos.' },
  { estado: 'Inactivo / Sin configurar / Sin conexiones', clase: 'estado-deferred', texto: 'El proceso está apagado o le falta configuración (variables del .env o bases).' },
  { estado: 'Desconectado / Sin conexión / Tiempo agotado', clase: 'estado-bounced', texto: 'No se pudo conectar: revisar red, firewall o que el servicio esté arriba.' },
  { estado: 'Clave rechazada / Acceso denegado', clase: 'estado-bounced', texto: 'La API key o el usuario no tiene permiso; revisar la clave en el .env.' },
  { estado: 'Límite de peticiones', clase: 'estado-deferred', texto: 'El servicio externo (ej. SendGrid) está limitando las consultas; esperar y reintentar.' },
  { estado: 'Con errores / Desconocido', clase: 'estado-bounced', texto: 'El último intento falló o no se pudo determinar el estado; ver el detalle de la tarjeta.' },
]

const PorEstado = new Map(ESTADOS_SENDGRID.map((e) => [e.estado, e.texto]))

// Texto para el tooltip de un estado de SendGrid en las tablas
export const describirEstadoSendgrid = (estado: string) => PorEstado.get(estado)
