import { useLogo } from '../sitio/logo.ts'
export default function CargaInicial({ mensaje = 'Preparando tu espacio' }: { mensaje?: string }) {
  const logo = useLogo()
  return <div className="carga-inicial" role="status" aria-label="Cargando aplicación">
    <div className="carga-emblema">{logo && <img src={logo} alt="Logo de la aplicación" />}<span className="carga-orbita" /></div>
    <p>{mensaje}<span className="carga-puntos">...</span></p>
  </div>
}
