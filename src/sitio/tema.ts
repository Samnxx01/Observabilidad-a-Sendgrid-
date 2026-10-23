import { api } from '../api/cliente.ts'
export const CAMPOS_TEMA = {
  exito: ["Texto de exito","--ok"],
  advertencia: ["Texto de advertencia","--warn"],
  error: ["Texto de error","--fail"],
  fondoError: ["Fondo de errores","--error-bg"],
  textoError: ["Texto de alertas de error","--error-text"],
  fondoInfo: ["Fondo informativo","--info-bg"],
  textoInfo: ["Texto informativo","--info-text"],
  fondo: ['Fondo de la app', '--bg'], superficie: ['Superficies', '--surface'], texto: ['Texto general', '--text'],
  textoTitulo: ['Titulos', '--text-h'], borde: ['Bordes', '--border'], boton: ['Boton principal', '--accent'], textoBoton: ['Texto del boton', '--accent-text'],
  botonSecundario: ['Boton secundario', '--secondary-bg'], textoSecundario: ['Texto secundario', '--secondary-text'],
  formulario: ['Fondo de formularios', '--form-bg'], textoFormulario: ['Texto de formularios', '--form-text'],
  campo: ['Fondo de campos', '--field-bg'], textoCampo: ['Texto de campos', '--field-text'],
} as const
export type Tema = Record<keyof typeof CAMPOS_TEMA, string>
export function aplicarTema(tema: Partial<Tema> | null) {
  for (const [campo, [, variable]] of Object.entries(CAMPOS_TEMA)) {
    const valor = tema?.[campo as keyof Tema]
    if (valor && /^#[0-9a-f]{6}$/i.test(valor)) document.documentElement.style.setProperty(variable, valor)
    else document.documentElement.style.removeProperty(variable)
  }
}
export async function cargarTema() {
  const { tema } = await api<{tema: Tema | null}>('/configuracion/tema', { notificar: false, signal: AbortSignal.timeout(10000) })
  aplicarTema(tema)
  return tema
}
