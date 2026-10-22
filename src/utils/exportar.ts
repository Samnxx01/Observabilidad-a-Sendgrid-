import { guardarArchivo } from './descargas.ts'

export type Formato = 'excel' | 'pdf'

export interface Columna<T> {
  titulo: string
  valor: (fila: T) => string | number | null | undefined
  // Ancho en caracteres (Excel); en el PDF se usa como peso relativo
  ancho?: number
}

export interface Exportacion<T> {
  // Nombre del archivo sin extension
  nombre: string
  titulo: string
  // Linea bajo el titulo, ej. los filtros aplicados
  detalle?: string
  columnas: Columna<T>[]
  filas: T[]
}

const ANCHO_POR_DEFECTO = 16

const generado = () => new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
}).format(new Date())

// Las librerias se cargan solo al exportar para no agrandar la carga inicial de la pagina
const exportarExcel = async <T>({ nombre, titulo, detalle, columnas, filas }: Exportacion<T>) => {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 4 }] })

  hoja.addRow([titulo]).font = { bold: true, size: 14 }
  hoja.addRow([`${detalle ? `${detalle} · ` : ''}Generado: ${generado()} · ${filas.length} registro(s)`])
  hoja.addRow([])

  const encabezado = hoja.addRow(columnas.map((c) => c.titulo))
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3BD6' } }
  })

  filas.forEach((fila) => hoja.addRow(columnas.map((c) => c.valor(fila) ?? '')))

  columnas.forEach((c, i) => {
    const columna = hoja.getColumn(i + 1)
    columna.width = c.ancho ?? ANCHO_POR_DEFECTO
    columna.alignment = { vertical: 'top', wrapText: (c.ancho ?? 0) > 30 }
  })
  hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columnas.length } }

  const contenido = await libro.xlsx.writeBuffer()
  guardarArchivo(
    new Blob([contenido], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${nombre}.xlsx`,
  )
}

const exportarPdf = async <T>({ nombre, titulo, detalle, columnas, filas }: Exportacion<T>) => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const documento = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const anchoUtil = documento.internal.pageSize.getWidth() - 60
  const pesoTotal = columnas.reduce((suma, c) => suma + (c.ancho ?? ANCHO_POR_DEFECTO), 0)

  documento.setFontSize(14)
  documento.text(titulo, 30, 36)
  documento.setFontSize(9)
  documento.text(`${detalle ? `${detalle} · ` : ''}Generado: ${generado()} · ${filas.length} registro(s)`, 30, 52)

  autoTable(documento, {
    startY: 64,
    margin: { left: 30, right: 30 },
    head: [columnas.map((c) => c.titulo)],
    body: filas.map((fila) => columnas.map((c) => String(c.valor(fila) ?? ''))),
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [91, 59, 214], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 246, 248] },
    columnStyles: Object.fromEntries(columnas.map((c, i) => [
      i, { cellWidth: (anchoUtil * (c.ancho ?? ANCHO_POR_DEFECTO)) / pesoTotal },
    ])),
    didDrawPage: () => {
      const pagina = documento.getCurrentPageInfo().pageNumber
      documento.setFontSize(8)
      documento.text(`Página ${pagina}`, documento.internal.pageSize.getWidth() - 70,
        documento.internal.pageSize.getHeight() - 16)
    },
  })

  guardarArchivo(documento.output('blob'), `${nombre}.pdf`)
}

export const exportarArchivo = <T>(formato: Formato, exportacion: Exportacion<T>) =>
  formato === 'excel' ? exportarExcel(exportacion) : exportarPdf(exportacion)
