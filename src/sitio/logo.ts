import { useSyncExternalStore } from 'react'
import { api } from '../api/cliente.ts'

export const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp']
export const MAX_LOGO_KB = 512

export interface InfoLogo {
  tipo: string
  actualizado: string
}

// URL del logo configurado (o null). Se comparte entre la barra, el login y la configuracion
// para que el cambio se vea en todas partes sin recargar la pagina.
let url: string | null = null
const oyentes = new Set<() => void>()

const ICONO_POR_DEFECTO = '/favicon.svg'

export const publicarLogo = (logo: InfoLogo | null) => {
  // ?v= cambia con cada logo nuevo para saltar la cache del navegador
  url = logo ? `/api/configuracion/logo?v=${encodeURIComponent(logo.actualizado)}` : null

  const icono = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (icono) {
    icono.href = url ?? ICONO_POR_DEFECTO
    icono.type = logo?.tipo ?? 'image/svg+xml'
  }
  oyentes.forEach((avisar) => avisar())
}

export const subirLogo = async (archivo: File) => {
  const { logo } = await api<{ logo: InfoLogo }>('/configuracion/logo', { method: 'PUT', body: archivo })
  publicarLogo(logo)
}

export const quitarLogo = async () => {
  await api<void>('/configuracion/logo', { method: 'DELETE' })
  publicarLogo(null)
}

const suscribir = (avisar: () => void) => {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

export const useLogo = () => useSyncExternalStore(suscribir, () => url)
