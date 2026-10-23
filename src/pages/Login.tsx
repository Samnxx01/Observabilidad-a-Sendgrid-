import CargaInicial from '../components/CargaInicial.tsx'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.ts'
import CampoContrasena from '../components/CampoContrasena.tsx'
import { ACCESO } from '../rutas/accesos.ts'
import { useRutas } from '../rutas/useRutas.ts'
import { useLogo } from '../sitio/logo.ts'

export default function Login() {
  const { iniciarSesion, aviso } = useAuth()
  const { rutas } = useRutas()
  const logo = useLogo()
  // Correo ya escrito, ej. al volver de crear la cuenta
  const correoInicial = (useLocation().state as { correo?: string } | null)?.correo ?? ''
  const [correo, setCorreo] = useState(correoInicial)
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  // El enlace a "Regístrate" solo si la ruta de registro se puede abrir sin sesion
  // (el backend exige sesion para crear usuarios, salvo el primero)
  const rutaRegistro = rutas.find((r) => r.componente === 'Registro')
  const registro = rutaRegistro && rutaRegistro.accessType?.codigo !== ACCESO.PRIVADA ? rutaRegistro.path : null

  // Al iniciar sesion, la guarda SoloInvitado redirige a la pagina que se pidio o al inicio
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (cargando) return
    setError(null)
    setCargando(true)
    try {
      await iniciarSesion(correo, contrasena)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
      setCargando(false)
    }
  }

  return (
    <main className="login" aria-busy={cargando}>
      {cargando && <div className="transicion-ruta transicion-sesion"><CargaInicial mensaje="Iniciando sesión" /></div>}
      <form className="tarjeta" onSubmit={enviar} noValidate>
        {logo && <img src={logo} alt="" className="logo-login" />}
        <h1>Iniciar sesión</h1>
        <p className="subtitulo">Consulta de envíos de facturación electrónica</p>

        {aviso && <p className="alerta alerta-info" role="status">{aviso}</p>}
        {error && <p className="alerta alerta-error" role="alert">{error}</p>}

        <label htmlFor="correo">Correo</label>
        <input
          id="correo"
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
          autoFocus={!correoInicial}
        />

        <label htmlFor="contrasena">Contraseña</label>
        <CampoContrasena
          id="contrasena"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          required
          autoFocus={Boolean(correoInicial)}
        />

        <button type="submit" disabled={cargando || !correo || !contrasena}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>

        {registro && (
          <p className="cambio-vista">
            ¿No tienes cuenta? <Link to={registro}>Regístrate</Link>
          </p>
        )}
      </form>
    </main>
  )
}
