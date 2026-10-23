import { useConfirmar } from './useConfirmar.ts'
import { useEffect, useState, type ChangeEvent } from 'react'
import { MAX_LOGO_KB, TIPOS_LOGO, quitarLogo, subirLogo, useLogo } from '../sitio/logo.ts'

const mensajeDe = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

// Logo de la web (barra superior, login y favicon). Se guarda en Mongo: coleccion configuracionsitio.
export default function ConfiguracionLogo() {
  const confirmar = useConfirmar()
  const logo = useLogo()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Libera la URL temporal de la vista previa al cambiar de archivo o salir
  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
  }, [vistaPrevia])

  const elegir = (evento: ChangeEvent<HTMLInputElement>) => {
    const elegido = evento.target.files?.[0] ?? null
    evento.target.value = ''
    setError(null)
    setMensaje(null)
    if (!elegido) return

    if (!TIPOS_LOGO.includes(elegido.type)) {
      setError('El logo debe ser una imagen PNG, JPG o WebP')
      return
    }
    if (elegido.size > MAX_LOGO_KB * 1024) {
      setError(`El logo no puede pesar más de ${MAX_LOGO_KB} KB (este pesa ${Math.ceil(elegido.size / 1024)} KB)`)
      return
    }
    setArchivo(elegido)
    setVistaPrevia(URL.createObjectURL(elegido))
  }

  const cancelar = () => {
    setArchivo(null)
    setVistaPrevia(null)
  }

  const guardar = async () => {
    if (!archivo) return
    setError(null)
    setGuardando(true)
    try {
      await subirLogo(archivo)
      cancelar()
      setMensaje('Logo actualizado')
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar el logo'))
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async () => {
    if (!await confirmar('¿Quitar el logo de la web?')) return
    setError(null)
    setMensaje(null)
    setGuardando(true)
    try {
      await quitarLogo()
      setMensaje('Logo eliminado')
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo quitar el logo'))
    } finally {
      setGuardando(false)
    }
  }

  const mostrado = vistaPrevia ?? logo

  return (
    <section className="config-logo" aria-labelledby="titulo-logo">
      <h2 id="titulo-logo">Logo de la web</h2>

      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta alerta-info" role="status">{mensaje}</p>}

      <div className="config-logo-contenido">
        <div className="config-logo-vista">
          {mostrado ? <img src={mostrado} alt="Vista previa del logo" /> : <span>Sin logo</span>}
        </div>
        <div className="config-logo-acciones">
          <p className="ayuda">
            PNG, JPG o WebP de máximo {MAX_LOGO_KB} KB. Se muestra en la barra superior, en el inicio de sesión y
            en la pestaña del navegador. Mejor con fondo transparente y formato horizontal o cuadrado.
          </p>
          <div className="acciones-form">
            <label className="boton-archivo">
              {logo ? 'Cambiar imagen…' : 'Elegir imagen…'}
              <input type="file" accept={TIPOS_LOGO.join(',')} onChange={elegir} disabled={guardando} />
            </label>
            {archivo && (
              <>
                <button type="button" onClick={guardar} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar logo'}
                </button>
                <button type="button" className="secundario" onClick={cancelar} disabled={guardando}>Cancelar</button>
              </>
            )}
            {logo && !archivo && (
              <button type="button" className="secundario peligro" onClick={quitar} disabled={guardando}>
                Quitar logo
              </button>
            )}
          </div>
          {archivo && <p className="ayuda">Vista previa de {archivo.name}; aún no se ha guardado.</p>}
        </div>
      </div>
    </section>
  )
}
