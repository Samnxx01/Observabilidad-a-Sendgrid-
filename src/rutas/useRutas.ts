import { use } from 'react'
import { RutasContext } from './RutasContext.ts'

export function useRutas() {
  const valor = use(RutasContext)
  if (!valor) {
    throw new Error('useRutas debe usarse dentro de <RutasProvider>')
  }
  return valor
}
