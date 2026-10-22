import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, type Usuario } from '../api/cliente.ts'
import { useAuth } from '../auth/useAuth.ts'
import CampoContrasena from '../components/CampoContrasena.tsx'
import { useRutas } from '../rutas/useRutas.ts'

// Crea usuarios. El backend exige sesion (salvo para el primer usuario), por eso la ruta va como privada.
export default function Registro() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const login = useRutas().pathDeComponente('Login') ?? '/'
  // Vuelve al login; si el registro fue exitoso, con el correo ya escrito
  const onIrALogin = (correo?: string) => navigate(login, { state: correo ? { correo } : null })
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [registrado, setRegistrado] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setError(null)

    if (contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)
    try {
      const { usuario } = await api<{ usuario: Usuario }>('/auth/registro', {
        method: 'POST',
        body: JSON.stringify({ correo, contrasena }),
      })
      setRegistrado(usuario.correo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar')
    } finally {
      setCargando(false)
    }
  }

  // Con sesion se queda en la pantalla para crear otro usuario
  const crearOtra = () => {
    setCorreo('')
    setContrasena('')
    setConfirmacion('')
    setRegistrado(null)
  }

  if (registrado) {
    return (
      <main className="login">
        <div className="tarjeta">
          <h1>Cuenta creada</h1>
          {usuario ? (
            <>
              <p className="subtitulo">
                El usuario <strong>{registrado}</strong> quedó registrado y ya puede iniciar sesión.
              </p>
              <button type="button" onClick={crearOtra}>Crear otra cuenta</button>
            </>
          ) : (
            <>
              <p className="subtitulo">
                El usuario <strong>{registrado}</strong> quedó registrado. Ya puedes iniciar sesión.
              </p>
              <button type="button" onClick={() => onIrALogin(registrado)}>Ir a iniciar sesión</button>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="login">
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <h1>Crear cuenta</h1>
        <p className="subtitulo">Crea un usuario para consultar los envíos</p>

        {error && <p className="alerta alerta-error" role="alert">{error}</p>}

        <label htmlFor="registro-correo">Correo</label>
        <input
          id="registro-correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
          autoFocus
        />

        <label htmlFor="registro-contrasena">Contraseña</label>
        <CampoContrasena
          id="registro-contrasena"
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          minLength={8}
          required
        />

        <label htmlFor="registro-confirmacion">Confirmar contraseña</label>
        <CampoContrasena
          id="registro-confirmacion"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          required
        />

        <button type="submit" disabled={cargando || !correo || !contrasena || !confirmacion}>
          {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        {!usuario && (
          <p className="cambio-vista">
            ¿Ya tienes cuenta? <Link to={login}>Inicia sesión</Link>
          </p>
        )}
      </form>
    </main>
  )
}
