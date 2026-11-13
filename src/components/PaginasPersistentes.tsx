import { Activity, useState, type ReactElement } from 'react'
import { matchPath, useLocation, useOutlet } from 'react-router'
import { ACCESO } from '../rutas/accesos.ts'
import { useRutas } from '../rutas/useRutas.ts'

interface Pagina {
  clave: string
  pathname: string
  elemento: ReactElement
}

// Conserva formularios y resultados en memoria mientras dure la sesion.
export default function PaginasPersistentes() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const { rutas } = useRutas()
  const [paginas, setPaginas] = useState<Pagina[]>([])
  const ruta = rutas.find((r) => r.accessType?.codigo === ACCESO.PRIVADA && matchPath(r.path, pathname))
  const clave = ruta ? JSON.stringify([ruta.id, ruta.path, ruta.componente, pathname]) : pathname
  // Una ruta eliminada, desactivada o reasignada no conserva su pantalla anterior.
  const vigentes = paginas.filter((pagina) => rutas.some((r) =>
    r.accessType?.codigo === ACCESO.PRIVADA &&
    pagina.clave === JSON.stringify([r.id, r.path, r.componente, pagina.pathname]),
  ))
  let visibles = vigentes
  if (outlet && ruta && !vigentes.some((pagina) => pagina.clave === clave)) {
    visibles = [...vigentes, { clave, pathname, elemento: outlet }]
  }
  if (visibles.length !== paginas.length || visibles.some((pagina, i) => pagina !== paginas[i])) {
    setPaginas(visibles)
  }

  return <>
    {visibles.map((pagina) => (
      <Activity key={pagina.clave} mode={pagina.clave === clave ? 'visible' : 'hidden'}>
        {pagina.elemento}
      </Activity>
    ))}
  </>
}
