# server-bus · frontend (app-sendgrid)

Aplicación web en **React + TypeScript + Vite** para consultar el estado de entrega de los correos de facturación electrónica enviados por **SendGrid** y auditar los rechazos. Consume la API del [backend](../../backend/README.md).

## Información general

- **Desarrollado por:** IndiGO Tech
- **Autores:**
  - Juan Diego Sánchez R. — [dsanchez@indigo.tech](mailto:dsanchez@indigo.tech)
- **Fecha:** 22 de octubre de 2026

## Requisitos

- **Node.js 22+**
- El **backend** corriendo (por defecto en `http://localhost:8080`).

## Instalación y arranque

```powershell
cd frontend\app-sendgrid
npm.cmd install    # la primera vez, o cuando cambian las dependencias
npm.cmd run dev    # desarrollo: http://localhost:5173
```

En PowerShell usa `npm.cmd`, porque `npm` a secas puede quedar bloqueado por la política de ejecución de scripts.

El comando se ejecuta dentro de `frontend\app-sendgrid`, que es donde está el `package.json`. Desde `frontend\` falla con `ENOENT ... package.json`.

| Script | Qué hace |
|---|---|
| `npm.cmd run dev` | Servidor de desarrollo con recarga en caliente |
| `npm.cmd run build` | Verifica tipos (`tsc -b`) y genera `dist/` para producción |
| `npm.cmd run preview` | Sirve `dist/` en local para probar el build |
| `npm.cmd run lint` | ESLint |

### Conexión con el backend

No hay URL del backend que configurar. Todas las llamadas van a `/api/...` y, en desarrollo, Vite las reenvía a `http://localhost:8080` ([vite.config.ts](vite.config.ts)). Si cambias el `PORT` del backend, cambia también esa línea.

En producción, sirve `dist/` y el backend bajo el **mismo dominio**, con un proxy que envíe `/api` al backend. La sesión viaja en una cookie `SameSite=Strict` con `Path=/api`, y no funciona entre dominios distintos.

## Sesión

- El login guarda la cookie **`sesion`** (HttpOnly). El frontend nunca ve ni guarda el token.
- Al cargar, la app consulta `GET /api/auth/sesion` para saber si ya hay sesión.
- Si una llamada protegida responde **401**, porque la sesión venció, la app vuelve al login.
- **Crear cuenta** exige sesión: solo un usuario autenticado puede crear otros. La única excepción, en el backend, es el primer usuario cuando no existe ninguno.

## Rutas dinámicas

Las rutas no están escritas en el código. Se leen del backend (`GET /api/rutas`, colección `rutasseguridad`) y se administran en la pantalla **Rutas**.

| Tipo de acceso | Quién entra |
|---|---|
| `PUBLICA` | Todos, con o sin sesión |
| `PRIVADA` | Solo con sesión; sin sesión redirige al login y luego vuelve a la página pedida |
| `SOLO_INVITADO` | Solo sin sesión (login); con sesión redirige al inicio |

Las rutas privadas que tienen título aparecen en el menú superior, en el orden configurado.

**Para agregar una pantalla nueva:**
1. Crea el componente en `src/pages/`.
2. Regístralo en [src/rutas/componentes.ts](src/rutas/componentes.ts).
3. Crea la ruta en la pantalla **Rutas**: path, título, componente y tipo de acceso.

`Login` y `ConfiguracionRutas` son componentes **críticos**. La pantalla Rutas pide confirmación antes de desactivarlos, borrarlos o cambiar su acceso, porque sin ellos no se podría entrar ni volver a configurar.

## Pantallas

### Eventos de rechazos (`Auditoria`)

Rechazos de SendGrid (`deferred`, `bounced`, `blocked`, `dropped`) guardados en MongoDB por la auditoría del backend.

- **Filtros:**
  - **Estado** y **Empresa** con selección múltiple; al cambiarlos filtra de una vez.
  - **Estado** incluye la opción *deferred pendientes*: los deferred que aún no se sabe en qué terminaron.
  - **Facturas:** varias, separadas por coma o espacio.
  - **Desde / Hasta:** rango de fechas, en hora Colombia.
- **Tabla:** paginada de **5 en 5** en el servidor, con totales por estado.
- **Sincronizar:** trae de SendGrid los rechazos nuevos de las empresas elegidas; sin ninguna elegida, de todas las bases activas.
- **Exportar:** descarga en **Excel (.xlsx)** o **PDF** *todos* los rechazos de la búsqueda, no solo la página visible. Máximo 50 000 registros.
- **Bases:** abre el modal para configurar qué bases de Azure SQL se auditan:
  - Por cada base se indica el nombre y la **fecha inicial**.
  - La fecha inicial permite como máximo **29 días atrás**, porque SendGrid solo guarda 30 días.
  - Al guardar, el backend se conecta a la base y lee la empresa (NIT y nombre) de `INEMPRESU`.
  - Las empresas configuradas alimentan los filtros de empresa de esta pantalla y de Facturas.
- **Programación:** abre el modal con dos secciones. Ambas son parámetros en MongoDB (no en el `.env`) y aplican de inmediato:
  - **Sincronización (watcher):** activo o pausado, cada cuántos minutos (1–1440, por defecto 5), *Ejecutar ahora* y el estado de la última y la próxima vuelta, incluido lo enviado y omitido en New Relic. El estado se refresca solo cada 10 s.
  - **Eliminación de registros:** activa o pausada, días a conservar (mínimo 31, porque SendGrid guarda 30), hora diaria, vista previa de cuántos se borrarían y *Eliminar ahora* con confirmación.

### Facturas

Consulta **en vivo** los envíos de SendGrid, en cualquier estado.

- **Empresas:** selección múltiple entre las configuradas en *Bases*.
- **Facturas:** varias, separadas por coma o espacio. Se pasan a mayúsculas, porque el asunto DIAN las tiene así y SendGrid distingue mayúsculas.
- **Estado:** selección múltiple entre los estados que devolvió SendGrid.
- **Facturas encontradas:** una etiqueta indica cuántas de las facturas buscadas tienen envíos (✓ todas, ⚠ faltan). *Ver no encontradas* lista las que faltan y permite copiarlas.
- **Exportar:** Excel o PDF de lo que muestra la tabla.

> SendGrid solo guarda **30 días** de historial, así que esta pantalla no encuentra envíos más antiguos.

### Rutas (`ConfiguracionRutas`)

- **Logo de la web:**
  - Acepta PNG, JPG o WebP de máximo 512 KB. No acepta SVG por seguridad.
  - Se muestra en la barra superior, en el login y como ícono de la pestaña.
- **Página después de iniciar sesión:**
  - Puede ser cualquier ruta privada y activa, o *Automática* (la primera ruta privada por orden).
  - Si alguien abrió una página protegida sin sesión, después del login vuelve a esa página.
- **Configuración de rutas:** crear, editar, activar o desactivar, ordenar y eliminar rutas.

### Iniciar sesión (`Login`) y Crear cuenta (`Registro`)

- **Login:** muestra el enlace *Regístrate* solo si la ruta de registro no es privada.
- **Crear cuenta, con sesión:** al terminar permite crear otra cuenta.

## Exportar a Excel y PDF

Los archivos se generan en el navegador con estas librerías:
- [`exceljs`](https://github.com/exceljs/exceljs) para Excel.
- [`jspdf`](https://github.com/parallax/jsPDF) + [`jspdf-autotable`](https://github.com/simonbengtsson/jsPDF-AutoTable) para PDF.

Se cargan **solo al exportar**, así que no aumentan la carga inicial de la página.

| Formato | Contenido |
|---|---|
| Excel | Título, filtros aplicados, fecha de generación y total. Encabezado fijo, autofiltro por columna, anchos ajustados |
| PDF | A4 horizontal, mismo encabezado, filas alternadas y número de página |

Con miles de registros, el PDF puede tener cientos de páginas y tardar varios segundos; para volúmenes grandes conviene más el Excel.

Las versiones están fijadas (`exceljs@4.4.0`, `jspdf@4.2.1`, `jspdf-autotable@5.0.8`). `npm audit` reporta 2 alertas moderadas de `uuid`, que trae `exceljs`. La falla está en funciones de `uuid` que `exceljs` no usa. `npm audit fix --force` las quitaría bajando `exceljs` a la 3.4.0, una versión de 2020 con cambios incompatibles, por eso no se aplica.

## Estructura

```
app-sendgrid/
├── index.html
├── vite.config.ts               # Proxy /api -> backend (localhost:8080) y React Compiler
└── src/
    ├── main.tsx                 # Arranque: router, sesión, rutas y configuración del sitio
    ├── App.tsx                  # Espera la verificación de sesión y pinta las rutas dinámicas
    ├── index.css                # Estilos globales (variables de color, modo oscuro)
    ├── api/
    │   ├── cliente.ts           # fetch a /api con la cookie de sesión; errores -> ErrorApi; 401 -> login
    │   ├── auditoria.ts         # Rechazos, sincronización, exportación y bases de auditoría
    │   └── rutas.ts             # CRUD de rutas y catálogo accesstype
    ├── auth/                    # Contexto de sesión: usuario, iniciarSesion, cerrarSesion
    ├── components/
    │   ├── Layout.tsx           # Barra superior: logo, menú y usuario
    │   ├── SeleccionMultiple.tsx # Desplegable con casillas para filtros
    │   ├── MenuExportar.tsx     # Botón Exportar con opciones Excel y PDF
    │   ├── ModalBasesAuditoria.tsx # Modal de bases a sincronizar
    │   ├── ConfiguracionLogo.tsx   # Sección "Logo de la web"
    │   ├── ConfiguracionInicio.tsx # Sección "Página después de iniciar sesión"
    │   └── CampoContrasena.tsx  # Campo de contraseña con botón mostrar/ocultar
    ├── pages/                   # Auditoria, Facturas, ConfiguracionRutas, Login, Registro
    ├── rutas/
    │   ├── componentes.ts       # Registro de componentes asignables a rutas
    │   ├── RutasDinamicas.tsx   # Construye las rutas desde rutasseguridad; '/' -> página de inicio
    │   ├── Guardias.tsx         # RequiereSesion y SoloInvitado
    │   └── accesos.ts           # Códigos PUBLICA / PRIVADA / SOLO_INVITADO
    ├── sitio/
    │   ├── sitio.ts             # Carga la configuración del sitio (GET /api/configuracion/sitio)
    │   ├── logo.ts              # Logo: estado compartido, subir y quitar
    │   └── inicio.ts            # Página después del login: estado compartido y guardar
    └── utils/
        ├── exportar.ts          # Genera Excel y PDF
        └── descargas.ts         # Descargar archivos y separar listas (facturas)
```

## Problemas comunes

| Error | Solución |
|---|---|
| `ENOENT ... frontend\package.json` | Estás en `frontend\`; entra a `frontend\app-sendgrid` |
| `npm : No se puede cargar el archivo ... npm.ps1` | Usa `npm.cmd` en lugar de `npm` |
| Las llamadas a `/api` fallan con `ECONNREFUSED` en la consola de Vite | El backend no está corriendo o usa otro puerto distinto de 8080 |
| Te devuelve al login en cada pantalla | La sesión venció (`VIGENCIA` en el backend); inicia sesión de nuevo |
| El selector de empresas está vacío | No hay bases configuradas: *Eventos de rechazos > Bases* |
| `Error consultando logs de SendGrid: lower bound must be within the last 30 days` | La búsqueda pide más de 30 días atrás; SendGrid no guarda más |
