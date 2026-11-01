# GestiónFelina — MVP de plataforma de gestion de colonias felinas

Plataforma SaaS para gestion de colonias felinas: El publico objetivo de la herramienta son tanto Asociaciones de voluntarios, usuarios voluntarios que gestionan colonias felinas y Ayuntamientos.
Por un lado, todo usuario tiene que estar comprendido dentro de una Organizacion, que podra ser una asociacion o un Ayuntamiento.
Todas las organizaciones deben ser aprobadas y validadas manualmente por el super administrador (que soy yo).
Cada organizacion puede tener uno o varios administradores con privilegios para invitar a nuevos usuarios, eliminar usuarios, crear colonias felinas, eliminar colonias felinas, etc...
Por otro lado, existen gatos, que se agrupan en colonias. Los gatos pueden estar asociados a una colonia o no, pero siempre son creados por un usuario que esta dentro de una organizacion. Todos los gatos tienen que tener una ubicacion, que necesariamente tiene que estar vinculada a un municipio del territorio de España.
Todos los gatos tienen una foto principal que se usara como foto de perfil de cada gato, el genero del gato, fecha de nacimiento (puede ser desconocida), y tiene asociadas distintas acciones como por ejemplo, castracion, visita a veterinario, captura, etc...
Cada accion esta gestionada po una organizacion, pueden participar varios usuarios y puede estar relacionada con varios gatos. Cada accion tiene fecha y hora, nombre, descripcion, si es urgente o no.

Cada Ayuntamiento es una organizacion que tiene asociado un municipio de España. Cada ayuntamiento, solo despues de estar validado manualmente, puede ver todas las colonias felinas que estan asociadas al municipio y puede validar las colonias como "autorizadas" por el ayuntamiento.

---

## 1. Puesta en marcha

Requisitos: Node 24+, [Vite+](https://viteplus.dev) (`vp`), PostgreSQL 14+ (local o
[Neon](https://neon.tech)) y, para los E2E, Google Chrome instalado.

```bash
vp install
cp .env.example .env.local          # rellena DATABASE_URL y BETTER_AUTH_SECRET
vp run db:setup                     # migraciones SQL + catálogo CPV oficial (9.454 códigos)
vp run job import --pages 5         # primera carga real desde PLACSP (~450 expedientes/página)
vp run dev                          # web http://localhost:3000 + API http://localhost:3001
vp run dev:worker                   # opcional: jobs programados (importación, avisos)
```

Todas las aplicaciones leen el mismo `.env.local` de la raíz; una variable definida en la
shell tiene prioridad (`DATABASE_URL=… vp run dev`).

En desarrollo `EMAIL_PROVIDER=console` imprime los correos (incluido el de restablecer
contraseña) en la consola de la API o del worker. Para enviar de verdad:
`EMAIL_PROVIDER=resend`, `RESEND_API_KEY` y un `EMAIL_FROM` de un dominio verificado.

### Neon

Crea una base de datos **nueva** (o una rama) para la app y usa su cadena del rol
propietario en `DATABASE_URL`. La migración `0004_rls.sql` crea el rol `app_user`
(`NOLOGIN`) y se lo concede al rol de conexión; Neon lo permite al propietario. El
endpoint con pooler (`-pooler`) sirve también para la API y el worker: el aislamiento por
empresa usa `SET LOCAL` dentro de transacciones (las pruebas de integración pasan contra
él). Esta app usa Better Auth **autoalojado** en `apps/api`: no configures
`BETTER_AUTH_URL` con la URL de Neon Auth.

### Scripts (desde la raíz)

| Comando                           | Qué hace                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `vp run dev`                      | Web (Vite, :3000) y API (tsx watch, :3001) en paralelo                                  |
| `vp run dev:worker`               | Worker con sus horarios (`SCHEDULE_*`)                                                  |
| `vp run job <nombre> [--pages N]` | Ejecuta un job una vez (ver §4)                                                         |
| `vp run build`                    | Build de las tres apps: `apps/web/.output` (Nitro), `apps/api/dist`, `apps/worker/dist` |
| `vp run db:migrate` / `db:seed`   | Aplica `packages/db/migrations/*.sql` (idempotente) / carga el catálogo CPV             |
| `vp check`                        | Formato, lint y type-check de todo el monorepo                                          |
| `vp test`                         | Unitarios + integración (integración solo si hay `TEST_DATABASE_URL`)                   |
| `vp run test:e2e`                 | Playwright contra web + API de desarrollo (escritorio y móvil)                          |

En producción: `node apps/web/.output/server/index.mjs`, `node apps/api/dist/index.mjs` y
`node apps/worker/dist/index.mjs` (o `node apps/worker/dist/cli.mjs sync` desde un cron
externo). La API y el worker empaquetan el código del monorepo y dejan fuera las
dependencias de terceros: despliega cada app con sus `node_modules`
(p. ej. `pnpm deploy --filter @licita/api`).

---

## 2. Arquitectura

```
apps/
  web/            @licita/web     TanStack Start: solo UI. Proxy same-origin /api/* → API
  api/            @licita/api     Hono: /api/auth/* (Better Auth) y /api/v1/* (API de la app)
  worker/         @licita/worker  Jobs programados (croner) + CLI de ejecución puntual
packages/
  db/             @licita/db            Drizzle (schema.ts refleja el SQL), withTenant() para RLS,
                                        migraciones SQL, catálogo CPV, carga de .env
  domain/         @licita/domain        Catálogos puros: provincias INE↔NUTS, tipos, estados,
                                        sectores, normalización de texto en español
  schemas/        @licita/schemas       Validación Zod compartida por la web y la API
  core/           @licita/core          Lógica de negocio por caso de uso (empresas, perfiles,
                                        licitaciones, seguimiento, panel)
  api-client/     @licita/api-client    Cliente tipado de /api/v1 (tipos inferidos de las rutas Hono)
  procurement/    @licita/procurement   Conectores + pipeline de importación (PLACSP)
  matching/       @licita/matching      scoring.ts (pura) · engine.ts (persistencia) · config.ts
  notifications/  @licita/notifications Correo (Resend/console), plantillas, resúmenes
  storage/        @licita/storage       Almacenamiento S3 compatible (archivo de páginas originales)
tests/            integration (incluida la API) · e2e · setup compartido
```

Dependencias (sin ciclos): `domain` ← `schemas`, `db` ← `matching`, `procurement`,
`notifications` ← `core` ← `api` ← `api-client` (solo tipos) ← `web`; `worker` usa
`procurement`, `matching`, `notifications` y `storage`. La web **no** depende de `db` ni de
`core`: solo de `api-client`, `domain` y `schemas`.

**Decisiones principales**

- **Una sola API para todos los clientes.** La web llama a la API con el mismo cliente
  tipado que podrá usar una app móvil. En el navegador va por el proxy `/api` de la web
  (cookie de sesión de primera parte, sin CORS, la URL de callback de Google no cambia);
  en el renderizado del servidor llama directamente a `API_URL` reenviando la cookie.
- **Rutas Hono encadenadas → tipos de extremo a extremo.** `@licita/api-client` infiere
  peticiones y respuestas de `apps/api` (las fechas llegan como cadenas ISO, como en JSON).
  Cambiar una ruta rompe la compilación de quien la usa.
- **Errores uniformes:** `{ "error": { "code": "NOT_FOUND", "message": "…" } }` con el
  estado HTTP correspondiente (401, 403, 404, 400, 429, 500); la web los traduce al español.
- **SQL como fuente de verdad.** El esquema entregado se aplica tal cual (`0001`); los
  cambios van en migraciones nuevas. Drizzle se usa como query builder tipado.
- **Better Auth sobre `users`.** La tabla pública `users` es el modelo de usuario de
  Better Auth (`name` → `full_name`, ids `uuid`). Hashes, sesiones y tokens van a tablas
  `auth_*` inaccesibles para el rol de la aplicación.
- **Aislamiento en la base de datos.** Cada servicio de `core` abre una transacción con
  `SET LOCAL ROLE app_user` y `app.user_id`; las políticas RLS hacen el resto. Además la
  API valida entradas con Zod y filtra por empresa explícitamente. El worker usa el rol
  propietario.
- **Defensa en la API:** cabeceras de seguridad, CSRF por origen para formularios, límite
  de 1 MB por petición, CORS solo para `APP_URL` y `TRUSTED_ORIGINS`, y límite de intentos
  de Better Auth por IP (la web reenvía la IP del visitante).
- **Worker sin colas.** Un proceso con horarios cron (`SCHEDULE_*`, zona Europe/Madrid);
  un job no se solapa consigo mismo y la importación se niega a arrancar si ya hay otra en
  curso, así que dos workers por error no duplican trabajo.
- **Archivo de procedencia.** Cada página descargada se registra en `import_run_pages`
  (URL, SHA-256, tamaño) y, si hay `S3_BUCKET`, se guarda comprimida en
  `raw/<conector>/<aaaa>/<mm>/<dd>/<import_run_id>/<página>.atom`. Un fallo del
  almacenamiento se anota en la importación, pero no la detiene.

---

## 3. Base de datos y seguridad

### Migraciones añadidas (sin renombrar ni borrar nada del esquema base)

| Migración                   | Contenido                                                                                                                                                                                                                                             | Motivo                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `0002_auth.sql`             | `users.email_verified/image/updated_at`; tablas `auth_sessions`, `auth_accounts`, `auth_verifications`                                                                                                                                                | Campos que Better Auth necesita en su modelo de usuario                                                |
| `0003_app_support.sql`      | `tenders.search_document` (tsvector sin tildes) + índices; `alert_profiles.sectors`; `tender_matches.first_matched_at`; `notification_deliveries.attempt_count/last_attempt_at`; tablas auxiliares `import_runs` y `cpv_codes`; triggers `updated_at` | Búsqueda en español, «nuevas» coincidencias reales, reintentos, auditoría de importación, catálogo CPV |
| `0004_rls.sql`              | Rol `app_user`, funciones `app_*` y políticas RLS en las 14 tablas                                                                                                                                                                                    | Separación entre clientes                                                                              |
| `0005_import_run_pages.sql` | Tabla interna `import_run_pages` (página, URL, SHA-256, tamaño, clave en S3), sin permisos para `app_user`                                                                                                                                            | Procedencia y reprocesado de importaciones                                                             |

### Políticas (resumen)

- Licitaciones, lotes, fuentes, eventos, organismos, CPV: **lectura pública**, sin escritura.
- Perfiles de alerta, seguimientos y tareas: CRUD solo dentro de la propia empresa; el
  responsable asignado debe pertenecer a la empresa.
- Coincidencias: lectura propia; solo se puede cambiar `feedback`. Las crea el motor.
- Notificaciones: cada persona ve las suyas; las escribe solo el job.
- `company_members` y `company_subscriptions`: **solo lectura**. La única forma de crear
  empresa + rol owner + plan Free es `app_create_company()` (SECURITY DEFINER), que usa
  el usuario de la sesión. No es posible autoconcederse privilegios ni cambiar el plan.
- Tablas `auth_*`: sin permisos para `app_user`.

Todo ello está cubierto por `tests/integration/rls.test.ts`.

**RGPD / minimización:** el registro solo pide nombre, email y contraseña; el NIF es
opcional y nunca se pide al registrarse. Los correos de recuperación no revelan si una
cuenta existe.

---

## 4. Ingesta de datos públicos (PLACSP)

Fuente: feed ATOM oficial _«Licitaciones publicadas en la Plataforma de Contratación del
Sector Público»_ (sindicación 643):
`https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom`.
Cada `<entry>` es la foto actual de un **expediente** (`ContractFolderStatus`, formato
CODICE); las publicaciones (`ValidNoticeInfo`) se guardan como `tender_events`; los lotes
(`ProcurementProjectLot`) como `tender_lots`; los `<at:deleted-entry>` marcan bajas. Las
páginas se enlazan con `rel="next"` hacia cambios más antiguos.

Los significados de los códigos se transcribieron de las listas genericode oficiales
que el propio feed referencia (estado, tipo de contrato, procedimiento, tipo de anuncio,
resultado, tipo de organismo, NUTS, CPV 2008).

- **Idempotencia y duplicados:** clave `(source_platform, external_record_id)` = id
  numérico de la entrada. Si la versión recibida no es más nueva que la guardada, no se
  toca. Los eventos tienen id estable `TIPO|medio|fecha` y un índice único.
- **Cambios relevantes:** estado, plazo, presupuesto, valor estimado y título generan
  eventos `status_change` / `change_detected` con valores anterior y nuevo.
- **Errores:** un registro defectuoso o un fallo de red se anotan en
  `import_runs.errors` sin detener la importación.
- **Incremental:** se recorre el feed hasta la marca de agua de la última ejecución
  correcta (`import_runs.high_water_mark`), con un máximo de `IMPORT_MAX_PAGES`.
- **Presupuestos:** `TaxExclusiveAmount` → presupuesto base sin IVA;
  `EstimatedOverallContractAmount` → valor estimado; `TotalAmount` (con IVA) en el resumen.
- **Nuevas fuentes:** implementar `SourceConnector` (`packages/procurement/src/types.ts`)
  y registrarlo en `apps/worker/src/jobs.ts`. El pipeline no cambia.

No hay datos ficticios en la base de datos: todo procede del feed real. El único fixture
(`packages/procurement/tests/fixtures/placsp/feed-page-1.atom`) es un extracto literal del feed, usado solo en
tests y marcado como tal.

### Jobs

El worker (`apps/worker`) los ejecuta según sus horarios; `vp run job <nombre>` (o
`node apps/worker/dist/cli.mjs <nombre>`) ejecuta uno y termina, útil para pruebas o para
un planificador externo (cron, Kubernetes CronJob, GitHub Actions…).

| Job       | Horario por defecto (`SCHEDULE_*`) | Qué hace                                                                             |
| --------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| `sync`    | cada 30 min                        | importa cambios → matching de los expedientes nuevos/cambiados → avisos «inmediatos» |
| `daily`   | diario, 7:00                       | resúmenes diarios                                                                    |
| `weekly`  | lunes, 7:00                        | resúmenes semanales                                                                  |
| `rematch` | diario, 3:30                       | recalcula todos los perfiles activos                                                 |
| `import`  | manual                             | solo importación (`--pages N`, `--full`)                                             |

---

## 5. Matching y notificaciones

Motor determinista y barato (`packages/matching`), sin IA de pago:

1. **Filtros duros:** licitación en plazo o anuncio previo; tipo de contrato; palabras
   excluidas; provincias (o toda España); presupuesto base sin IVA dentro del rango.
2. **Señales de relevancia** (solo las que el perfil configuró): CPV (contenido en su
   código, categoría superior o misma familia), palabras clave, y términos de la
   descripción en lenguaje natural (normalización y stemming ligero en español).
   Sin al menos una señal clara no hay coincidencia: provincia o importe por sí solos no
   bastan, ni un CPV solo «de la misma familia».
3. **Puntuación** `85 × relevancia + 10 × lugar + 5 × presupuesto`, pesos en
   `config.ts`; se guardan las ≥ 30 en `tender_matches` con la explicación en
   `match_reason` y los lotes afines en `matched_lot_codes`.

La función `scoreTender` es pura, lista para combinarse con una señal semántica.

**Notificaciones:** cada (persona, perfil, licitación) tiene un `dedupe_key` único en
`notification_deliveries`. El job reclama filas con `INSERT … ON CONFLICT DO NOTHING`,
envía un único resumen por persona y empresa, y registra `sent`/`failed`. Los errores
temporales se reintentan (máx. 3); los permanentes no. Las coincidencias descartadas por
el usuario no se envían. Hay un correo de prueba en **Ajustes** (máx. 1 por minuto).

---

## 6. Estado del MVP

### Implementado y verificado

| Funcionalidad                                                                                                                                                                      | Cómo se verificó                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Registro, inicio/cierre de sesión, rutas privadas                                                                                                                                  | E2E `journey.spec.ts`                                                              |
| Recuperación de contraseña (Better Auth + correo)                                                                                                                                  | Prueba manual por API: correo → enlace → nueva clave → login; token de un solo uso |
| Onboarding de empresa + edición en Ajustes; empresa ↔ usuarios con roles                                                                                                           | E2E + RLS                                                                          |
| Perfiles de alerta (CRUD, varios por empresa, activar/desactivar, sectores, CPV con sugerencias editables, palabras clave, provincias/toda España, tipos, presupuesto, frecuencia) | E2E + unitarios de validación                                                      |
| Importación real de PLACSP: 7.112 expedientes, 4.952 lotes, 22.554 eventos sin errores                                                                                             | Ejecución real; reimportación = 0 duplicados                                       |
| Idempotencia, cambios, bajas, errores aislados, auditoría                                                                                                                          | Integración `ingestion.test.ts`                                                    |
| Búsqueda con todos los filtros pedidos, orden por fecha/plazo/relevancia/importe, paginación                                                                                       | Manual + E2E                                                                       |
| Detalle con lotes, organismo, anuncios y cambios, documentos, resultado, procedencia y enlace oficial                                                                              | E2E                                                                                |
| Matching con explicación, guardado en `tender_matches`, valoración relevante/no relevante                                                                                          | Unitarios + integración + revisión manual de resultados reales                     |
| Panel con datos reales (nuevas, abiertas, guardadas, vencimientos, tareas, últimos avisos, última importación)                                                                     | E2E                                                                                |
| Mis licitaciones: guardar/dejar de seguir, estados internos, notas, tareas                                                                                                         | E2E + integración RLS                                                              |
| Resúmenes diario/semanal/inmediato, sin duplicados, reintentos                                                                                                                     | Integración + ejecución real con mailer `console`                                  |
| Aislamiento entre empresas y no escalada de privilegios                                                                                                                            | `rls.test.ts` (base de datos) + `api.test.ts` (a través de la API)                 |
| API Hono: sesión, onboarding, validación con mensajes, errores JSON, CSRF                                                                                                          | `api.test.ts` (Better Auth real + cliente tipado)                                  |
| Archivo de páginas originales en S3 (comprimido) y procedencia en `import_run_pages`                                                                                               | `archive.test.ts` + `s3.test.ts` (servidor S3 de prueba con firma SigV4)           |
| Worker: horarios, ejecución puntual, apagado ordenado; builds de API y worker                                                                                                      | Ejecución real (`sync` con PLACSP, `rematch`) desde el código y desde `dist/`      |
| Responsive (tablas → tarjetas, menú lateral → hoja)                                                                                                                                | E2E móvil (Pixel 7)                                                                |
| `vp check` (formato, lint, tipos estrictos), `vp build`                                                                                                                            | Sin errores                                                                        |

### Limitaciones conocidas

- **Resend no se ha probado con una clave real** (no había credenciales). El adaptador
  sigue la API documentada (`POST /emails`); configúralo y usa «Enviar correo de prueba».
- Solo se usa el feed «perfiles alojados en PLACSP». El feed de plataformas agregadas
  (CC. AA.) y los ficheros históricos mensuales no están conectados.
- El texto se compara en castellano; títulos en catalán, euskera o gallego solo encajan
  por CPV o por palabras clave en ese idioma.
- La empresa activa es la primera membresía; no hay invitaciones ni selector de empresa.
- La carga inicial está limitada por `IMPORT_MAX_PAGES` (no trae todo el histórico).
- El archivo S3 se ha probado contra un servidor S3 de prueba, no contra un proveedor real.
- La API no tiene aún autenticación por token para apps nativas (añadir el plugin
  `bearer` de Better Auth cuando exista la app móvil).

### Siguientes pasos recomendados

1. Conector del feed de plataformas agregadas (sindicación 1044) y de TED reutilizando
   el `SourceConnector`; deduplicación entre fuentes por expediente + órgano.
2. Invitaciones de usuarios a la empresa (función `SECURITY DEFINER` + email) y selector
   de empresa.
3. Avisos de modificaciones y recordatorios de plazo para licitaciones guardadas
   (los eventos `change_detected` y `notification_type` ya lo permiten).
4. Señal semántica opcional (embeddings baratos sobre título + descripción) sumada a
   `scoreTender`, usando el feedback recogido para ajustar pesos.
5. Planes Free/Starter/Pro con Stripe escribiendo en `company_subscriptions` solo desde
   un webhook del servidor.
6. Observabilidad de jobs (alertar si `import_runs` falla varias veces seguidas).
