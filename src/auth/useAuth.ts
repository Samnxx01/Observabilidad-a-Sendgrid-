import { use } from 'react'
import { AuthContext } from './AuthContext.ts'

export function useAuth() {
  const valor = use(AuthContext)
  if (!valor) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return valor
}
