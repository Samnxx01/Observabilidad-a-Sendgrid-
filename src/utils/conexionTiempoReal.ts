import { useSyncExternalStore } from 'react'
let conectado = false
const oyentes = new Set<() => void>()
export function publicarConexion(valor: boolean) { conectado = valor; oyentes.forEach(fn => fn()) }
const suscribir = (fn: () => void) => { oyentes.add(fn); return () => { oyentes.delete(fn) } }
export const useConexionTiempoReal = () => useSyncExternalStore(suscribir, () => conectado)
