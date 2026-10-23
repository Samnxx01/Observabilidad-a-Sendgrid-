interface Props {
  valor: string
  etiqueta: string
  deshabilitado?: boolean
  onCambio: (color: string) => void
}
// El valor del tema sigue vacio hasta que el usuario elige un color.
export default function SelectorColor({ valor, etiqueta, deshabilitado, onCambio }: Props) {
  const valido = /^#[0-9a-f]{6}$/i.test(valor)
  return <label className="tema-selector" title={'Seleccionar color: ' + etiqueta}
    style={{ backgroundColor: valido ? valor : 'transparent' }}>
    <input type="color" value={valido ? valor : undefined} disabled={deshabilitado}
      aria-label={'Seleccionar color: ' + etiqueta}
      onChange={evento => onCambio(evento.target.value.toUpperCase())} />
    {!valido && <span aria-hidden="true">+</span>}
  </label>
}
