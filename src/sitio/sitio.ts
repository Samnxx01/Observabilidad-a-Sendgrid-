import { api } from '../api/cliente.ts'
import { publicarInicio } from './inicio.ts'
import { publicarLogo, type InfoLogo } from './logo.ts'

// Configuracion general del sitio (coleccion configuracionsitio): logo y pagina despues del login
export const cargarSitio = () =>
  api<{ logo: InfoLogo | null; rutaInicio: string | null }>('/configuracion/sitio')
    .then((r) => {
      publicarLogo(r.logo)
      publicarInicio(r.rutaInicio)
    })
    .catch(() => publicarLogo(null))
