import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth.ts'
import { ACCESO } from '../rutas/accesos.ts'
import { useRutas } from '../rutas/useRutas.ts'
import { useLogo } from '../sitio/logo.ts'

// Marco de las paginas privadas: barra superior con el menu (rutas privadas con titulo)
export default function Layout() {
  const { usuario, cerrarSesion } = useAuth()
  const { rutas } = useRutas()
  const logo = useLogo()
  const menu = rutas.filter((r) => r.accessType?.codigo === ACCESO.PRIVADA && r.titulo && !r.path.includes(':'))

  return (
    <div className="pagina">
      <header className="barra">
        <strong className="marca">
          {logo && <img src={logo} alt="" className="logo" />}
          Envíos SendGrid
        </strong>
        <nav className="menu">
          {menu.map((r) => (
            <NavLink key={r.id} to={r.path}>{r.titulo}</NavLink>
          ))}
        </nav>
        <div className="barra-usuario">
          <span>{usuario?.correo}</span>
          <button type="button" className="secundario" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
