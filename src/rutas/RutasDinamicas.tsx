import CargaInicial from '../components/CargaInicial.tsx'
import TransicionRuta from '../components/TransicionRuta.tsx'
import { createElement, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import type { Ruta } from '../api/rutas.ts'
import { useAuth } from '../auth/useAuth.ts'
import Layout from '../components/Layout.tsx'
import { ACCESO } from './accesos.ts'
import { COMPONENTES } from './componentes.ts'
import { RequiereSesion, SoloInvitado } from './Guardias.tsx'
import { useRutas } from './useRutas.ts'
import { useRutaInicio } from '../sitio/inicio.ts'

const Cargando = CargaInicial

function ComponenteNoRegistrado({ nombre }: { nombre: string }) {
  return (
    <p className="alerta alerta-error">
      El componente <strong>{nombre}</strong> no está registrado en el frontend (src/rutas/componentes.ts).
    </p>
  )
}

function NoEncontrada() {
  return (
    <main className="login">
      <div className="tarjeta">
        <h1>Página no encontrada</h1>
        <p className="subtitulo">La ruta no existe, no está activa o tu rol no tiene acceso a ella.</p>
        <Link to="/">Ir al inicio</Link>
      </div>
    </main>
  )
}

// '/' lleva a la primera ruta (por orden) que corresponda: privada con sesion, de invitado sin ella
// Con sesion, primero la pagina configurada en "Página después de iniciar sesión" (si sigue activa y privada)
function Inicio() {
  const { usuario } = useAuth()
  const { rutas } = useRutas()
  const rutaInicio = useRutaInicio()
  const configurada = usuario
    ? rutas.find((r) => r.id === rutaInicio && r.accessType?.codigo === ACCESO.PRIVADA)
    : undefined
  const destino = configurada ?? rutas.find((r) => r.path !== '/' && (usuario
    ? r.accessType?.codigo === ACCESO.PRIVADA
    : r.accessType?.codigo !== ACCESO.PRIVADA))

  return destino
    ? <Navigate to={destino.path} replace />
    : <p className="cargando">No hay rutas configuradas.</p>
}

const elemento = (ruta: Ruta) => {
  const componente = COMPONENTES[ruta.componente]
  return componente
    ? createElement(componente)
    : <ComponenteNoRegistrado nombre={ruta.componente} />
}

// Construye las rutas del frontend a partir de la coleccion rutasseguridad
export default function RutasDinamicas() {
  const { rutas, cargando, error } = useRutas()
  const { pathname } = useLocation()

  if (cargando) {
    return <Cargando />
  }
  if (error) {
    return <p className="alerta alerta-error contenido">{error}</p>
  }

  const conAcceso = (codigo: string) => rutas.filter((r) => r.accessType?.codigo === codigo)
  const aRoute = (r: Ruta) => <Route key={r.id} path={r.path} element={elemento(r)} />
  // Una publica con roles necesita saber el rol: pide sesion (sin el menu de las privadas)
  const publicas = conAcceso(ACCESO.PUBLICA)
  const publicasConRoles = publicas.filter((r) => r.roles?.length)
  const publicasAbiertas = publicas.filter((r) => !r.roles?.length)

  return (
    <>
    <TransicionRuta key={pathname} />
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route element={<RequiereSesion />}>
          <Route element={<Layout />}>
            {conAcceso(ACCESO.PRIVADA).map(aRoute)}
          </Route>
          {publicasConRoles.map(aRoute)}
        </Route>

        <Route element={<SoloInvitado />}>
          {conAcceso(ACCESO.SOLO_INVITADO).map(aRoute)}
        </Route>

        {publicasAbiertas.map(aRoute)}

        {!rutas.some((r) => r.path === '/') && <Route path="/" element={<Inicio />} />}
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
    </Suspense>
    </>
  )
}
