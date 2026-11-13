import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

// Componentes que se pueden asignar a una ruta desde la configuracion
// (campo "componente" de la coleccion rutasseguridad). Para que una pantalla nueva
// se pueda usar en una ruta dinamica, hay que registrarla aqui.
export const COMPONENTES: Record<string, LazyExoticComponent<ComponentType>> = {
  AccesoIpSendgrid: lazy(() => import('../pages/AccesoIpSendgrid.tsx')),
  EstadoServicios: lazy(() => import('../pages/EstadoServicios.tsx')),
  Login: lazy(() => import('../pages/Login.tsx')),
  Registro: lazy(() => import('../pages/Registro.tsx')),
  Facturas: lazy(() => import('../pages/Facturas.tsx')),
  Auditoria: lazy(() => import('../pages/Auditoria.tsx')),
  NotificacionesFactura: lazy(() => import('../pages/NotificacionesFactura.tsx')),
  Dropped: lazy(() => import('../pages/Dropped.tsx')),
  ConfiguracionRutas: lazy(() => import('../pages/ConfiguracionRutas.tsx')),
}

export const NOMBRES_COMPONENTES = Object.keys(COMPONENTES)

// Componentes sin los cuales no se puede iniciar sesion ni volver a configurar las rutas
export const COMPONENTES_CRITICOS = ['Login', 'ConfiguracionRutas']
