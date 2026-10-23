import { createContext, useContext } from 'react'
export type Confirmar = (mensaje: string) => Promise<boolean>
export const ConfirmacionContext = createContext<Confirmar | null>(null)
export function useConfirmar() {
  const confirmar = useContext(ConfirmacionContext)
  if (!confirmar) throw new Error('Falta ConfirmacionProvider')
  return confirmar
}
