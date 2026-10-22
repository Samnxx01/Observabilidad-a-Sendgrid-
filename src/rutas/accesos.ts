// Codigos del catalogo accesstype que el frontend sabe interpretar
export const ACCESO = {
  PUBLICA: 'PUBLICA',             // con o sin sesion
  PRIVADA: 'PRIVADA',             // requiere sesion
  SOLO_INVITADO: 'SOLO_INVITADO', // solo sin sesion (login, registro)
} as const
