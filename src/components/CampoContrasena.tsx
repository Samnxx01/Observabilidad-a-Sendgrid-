import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

// Input de contraseña con boton para mostrarla u ocultarla (cada campo es independiente)
export default function CampoContrasena(props: Props) {
  const [visible, setVisible] = useState(false)
  const etiqueta = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <div className="campo-contrasena">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="ver-contrasena"
        onClick={() => setVisible((v) => !v)}
        aria-label={etiqueta}
        aria-pressed={visible}
        title={etiqueta}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  )
}
