// Descarga un Blob en el navegador con el nombre indicado
export const guardarArchivo = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

// Parte un texto con valores separados por coma, punto y coma, espacio o salto de linea
export const separarValores = (texto: string) =>
  [...new Set(texto.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean))]
