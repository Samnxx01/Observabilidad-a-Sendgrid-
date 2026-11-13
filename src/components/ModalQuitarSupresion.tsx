import { useEffect, useRef, useState } from 'react'
import { api } from '../api/cliente.ts'
import { notificar } from '../utils/toast.ts'
import { useConfirmar } from './useConfirmar.ts'

export interface DestinatarioSupresion {
  to_email: string
  envios: number
  listaMotivos: string[]
}

interface RespuestaQuitar {
  quitados: { email: string; listas: string[] }[]
  omitidos: { email: string; motivo: string }[]
}

// Motivos cuya lista de supresion se puede limpiar (ver backend/src/sendgrid/supresiones.js).
// Unsubscribed y Spam Reporting Address no: el destinatario pidio no recibir correos.
const MOTIVOS_QUITABLES = ['Bounced Address', 'Invalid']
export const sePuedeQuitar = (d: DestinatarioSupresion) => d.listaMotivos.some((m) => MOTIVOS_QUITABLES.includes(m))

export const ACCIONES_SUPRESION = {
  dropped: { nombre: 'Dropped', ayuda: 'Quita de bounces o invalid_emails segun el motivo del evento.' },
  bounces: { nombre: 'Bounces', ayuda: 'Quita los correos seleccionados de la lista de rebotes.' },
  blocks: { nombre: 'Blocks', ayuda: 'Elimina los registros de bloqueo de los correos seleccionados.' },
  invalid_emails: { nombre: 'Invalid emails', ayuda: 'Quita los correos seleccionados de la lista de direcciones invalidas.' },
} as const
export type AccionSupresion = keyof typeof ACCIONES_SUPRESION

interface Props {
  accion: AccionSupresion
  // Destinatarios de la busqueda (con los filtros aplicados)
  destinatarios: DestinatarioSupresion[]
  // Correos ya quitados en esta sesion: no se vuelven a ofrecer
  quitados: Set<string>
  onQuitados: (emails: string[]) => void
  onCerrar: () => void
}

// Elige destinatarios de los dropped y los quita de la lista de supresion de SendGrid
// (DELETE /api/dropped/supresiones/dropped). No reenvia los correos ya descartados.
export default function ModalQuitarSupresion({ accion, destinatarios, quitados, onQuitados, onCerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const confirmar = useConfirmar()
  const permite = (d: DestinatarioSupresion) => accion !== 'dropped' || sePuedeQuitar(d)
  const disponibles = destinatarios.filter((d) => permite(d) && !quitados.has(`${accion}|${d.to_email}`))
  const noPermitidos = destinatarios.filter((d) => !permite(d))
  // Con un solo destinatario (ej. buscado por correo) ya viene marcado
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(disponibles.length === 1 ? [disponibles[0].to_email] : []),
  )
  const [filtro, setFiltro] = useState('')
  const [quitando, setQuitando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const modal = dialogo.current
    if (modal && !modal.open) modal.showModal()
  }, [])

  const texto = filtro.trim().toLowerCase()
  const visibles = disponibles.filter((d) => !texto || d.to_email.includes(texto))
  const todosMarcados = visibles.length > 0 && visibles.every((d) => seleccion.has(d.to_email))

  const marcar = (emails: string[], marcado: boolean) => {
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      emails.forEach((e) => (marcado ? nueva.add(e) : nueva.delete(e)))
      return nueva
    })
  }

  const quitar = async () => {
    const elegidos = disponibles.filter((d) => seleccion.has(d.to_email))
    const ok = await confirmar(
      `Quitar ${elegidos.length} correo(s) mediante ${ACCIONES_SUPRESION[accion].nombre}? `
      + ACCIONES_SUPRESION[accion].ayuda,
    )
    if (!ok) return
    setError(null)
    setQuitando(true)
    try {
      const respuesta = await api<RespuestaQuitar>(`/dropped/supresiones/${accion}`, {
        method: 'DELETE',
        body: JSON.stringify(accion === 'dropped'
          ? { destinatarios: elegidos.map((d) => ({ email: d.to_email, motivos: d.listaMotivos })) }
          : { emails: elegidos.map((d) => d.to_email) }),
      })
      onQuitados(respuesta.quitados.map((q) => `${accion}|${q.email}`))
      notificar(`${respuesta.quitados.length} correo(s) quitados de la supresión`
        + (respuesta.omitidos.length ? ` · ${respuesta.omitidos.length} omitido(s)` : ''))
      dialogo.current?.close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar de la supresión')
    } finally {
      setQuitando(false)
    }
  }

  return (
    <dialog ref={dialogo} className="modal" aria-labelledby="titulo-supresion" onClose={onCerrar}>
      <div className="modal-cabecera">
        <h2 id="titulo-supresion">Quitar de {ACCIONES_SUPRESION[accion].nombre}</h2>
        <button type="button" className="secundario" onClick={() => dialogo.current?.close()}>Cerrar</button>
      </div>
      <p className="ayuda">{ACCIONES_SUPRESION[accion].ayuda}</p>
      {error && <p className="alerta alerta-error" role="alert">{error}</p>}
      {disponibles.length === 0 ? (
        <p className="vacio">No hay destinatarios para quitar en esta búsqueda.</p>
      ) : (
        <>
          <div className="busqueda">
            <div className="campo">
              <label htmlFor="supresion-filtro">Buscar correo</label>
              <input id="supresion-filtro" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            </div>
          </div>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Marcar todos"
                      checked={todosMarcados}
                      onChange={(e) => marcar(visibles.map((d) => d.to_email), e.target.checked)}
                    />
                  </th>
                  <th>Destinatario</th>
                  <th>Envíos dropped</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((d) => (
                  <tr key={d.to_email}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Marcar ${d.to_email}`}
                        checked={seleccion.has(d.to_email)}
                        onChange={(e) => marcar([d.to_email], e.target.checked)}
                      />
                    </td>
                    <td>{d.to_email}</td>
                    <td>{d.envios}</td>
                    <td>{d.listaMotivos.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {noPermitidos.length > 0 && (
        <p className="ayuda">
          {noPermitidos.length} destinatario(s) no se pueden quitar desde aquí (Unsubscribed o Spam Reporting Address).
        </p>
      )}

      <div className="acciones-form">
        <button type="button" onClick={quitar} disabled={quitando || seleccion.size === 0}>
          {quitando ? 'Quitando...' : `Quitar de ${ACCIONES_SUPRESION[accion].nombre} (${seleccion.size})`}
        </button>
      </div>
    </dialog>
  )
}
