# GestiónFelina — MVP de gestión de colonias felinas

Plataforma SaaS para **asociaciones** de voluntariado felino y **ayuntamientos**:

- Toda persona pertenece a **una sola organización**: una asociación o un ayuntamiento.
- Toda organización la **aprueba a mano el superadministrador**. Las asociaciones se
  registran solas (quedan pendientes); los ayuntamientos **no se registran**: los da de
  alta el superadministrador (uno por municipio) e invita a su responsable.
- Los **administradores** de cada organización invitan y eliminan personas y cambian roles.
  En una asociación, además, crean, editan y eliminan colonias y resuelven las propuestas
  del ayuntamiento.
- **Colonias**: una única asociación gestora, ubicación exacta (coordenadas), municipio INE
  y dirección opcional. El ayuntamiento del municipio puede **autorizarlas**.
- **Gatos**: siempre de una organización, con o sin colonia, foto principal obligatoria,
  sexo, fecha de nacimiento (desconocida o aproximada) y ubicación con municipio.
- **Acciones** (castración, veterinario, captura, suelta, alimentación, otro): de una
  asociación, con fecha y hora, nombre, descripción, urgencia, estado (planificada, en
  proceso, realizada, cancelada), varios gatos y varios participantes.
- El **ayuntamiento** ve (solo lectura) colonias, gatos y acciones de su municipio, recibe
  todas las acciones en un **feed** donde las valida o las deja sin validar, y **propone
  cambios** en colonias y gatos que la asociación gestora acepta o rechaza.

---

## 1. Puesta en marcha

Requisitos: Node 24+, [Vite+](https://viteplus.dev) (`vp`), PostgreSQL 14+ (local o
[Neon](https://neon.tech)) con las extensiones `pgcrypto`, `unaccent` y `pg_trgm`, y Google
Chrome para los E2E.

```bash
vp install
cp .env.example .env.local          # rellena DATABASE_URL y BETTER_AUTH_SECRET
vp run db:setup                     # migraciones SQL + 8.132 municipios del INE
vp run dev                          # web http://localhost:3000 + API http://localhost:3001
# Regístrate en la web y conviértete en superadministrador:
vp run admin:grant tu@email.es
vp run dev:worker                   # opcional: recordatorios diarios por email
```

Todas las aplicaciones leen el mismo `.env.local` de la raíz; una variable definida en la
shell tiene prioridad (`DATABASE_URL=… vp run dev`).

- **Correo**: `EMAIL_PROVIDER=console` imprime los correos (invitaciones, restablecer
  contraseña…) en la consola de la API. Para enviarlos: `EMAIL_PROVIDER=resend`,
  `RESEND_API_KEY` y un `EMAIL_FROM` de un dominio verificado.
- **Fotos**: sin `S3_BUCKET` se guardan en `.data/uploads` (ignorado por git). En producción
  configura un bucket S3/R2 (`S3_*`).

### Scripts (desde la raíz)

| Comando                         | Qué hace                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| `vp run dev`                    | Web (Vite, :3000) y API (tsx watch, :3001) en paralelo                     |
| `vp run dev:worker`             | Worker con su horario (`SCHEDULE_REMINDERS`)                               |
| `vp run job reminders`          | Envía una vez los recordatorios del día                                    |
| `vp run admin:grant <email>`    | Concede (o con `--revoke` retira) el rol de superadministrador             |
| `vp run build`                  | Build de web (`apps/web/.output`), API (`apps/api/dist`) y worker          |
| `vp run db:migrate` / `db:seed` | Aplica `packages/db/migrations/*.sql` (idempotente) / carga los municipios |
| `vp check`                      | Formato, lint y type-check de todo el monorepo                             |
| `vp test`                       | Unitarios + integración (integración solo si hay `TEST_DATABASE_URL`)      |
| `vp run test:e2e`               | Playwright contra la web y la API de desarrollo (escritorio y móvil)       |

En producción: `node apps/web/.output/server/index.mjs`, `node apps/api/dist/index.mjs` y
`node apps/worker/dist/index.mjs` (o `node apps/worker/dist/cli.mjs reminders` desde un cron
externo). Despliega cada app con sus `node_modules` (p. ej. `pnpm deploy --filter @felina/api`).

---

## 2. Arquitectura

```
apps/
  web/            @felina/web     TanStack Start: solo UI. Proxy same-origin /api/* → API
  api/            @felina/api     Hono: /api/auth/* (Better Auth) y /api/v1/* (API de la app)
  worker/         @felina/worker  Jobs programados (croner) + CLI de ejecución puntual
packages/
  db/             @felina/db            Drizzle (schema.ts refleja el SQL), withTenant() para RLS,
                                        migraciones SQL, municipios INE, admin:grant
  domain/         @felina/domain        Vocabularios cerrados y etiquetas, provincias, municipios,
                                        fechas en Europe/Madrid
  schemas/        @felina/schemas       Validación Zod compartida por la web y la API
  core/           @felina/core          Casos de uso: organizaciones, admin, colonias, gatos,
                                        acciones, propuestas, panel
  api-client/     @felina/api-client    Cliente tipado de /api/v1 (tipos inferidos de las rutas Hono)
  notifications/  @felina/notifications Correo (Resend/console), plantillas, recordatorios
  storage/        @felina/storage       Fotos: S3 compatible o disco local
tests/            integration (RLS + API completa) · e2e (recorrido completo y móvil)
```

Dependencias (sin ciclos): `domain` ← `schemas`, `db` ← `storage`, `notifications` ← `core`
← `api` ← `api-client` (solo tipos) ← `web`. La web **no** depende de `db` ni de `core`.

**Decisiones principales**

- **Permisos en la base de datos.** Cada petición abre una transacción con
  `SET LOCAL ROLE app_user` y `app.user_id`; las políticas RLS de
  `packages/db/migrations/0002_rls.sql` deciden qué ve y qué toca cada persona. La API
  además comprueba rol y tipo de organización para dar errores claros.
- **Operaciones sensibles como funciones `SECURITY DEFINER`** que comprueban quién llama:
  registrar una asociación, aceptar una invitación, aprobar/rechazar/suspender
  organizaciones, autorizar colonias y validar acciones. Nadie puede autoasignarse un rol,
  unirse a una organización sin invitación, autorizar sus propias colonias ni validarse
  sus acciones.
- **Una persona, una organización**: `organization_members.user_id` es la clave primaria.
- **Un ayuntamiento por municipio**: índice único parcial sobre `organizations`.
- **Municipio = código INE** (`municipalities`, 8.132 municipios a 1/1/2025). Es lo que
  relaciona colonias, gatos y acciones con su ayuntamiento; el nombre se muestra en texto
  («A Coruña», no «Coruña, A») y se busca sin tildes.
- **Acciones y municipio**: el de su colonia; si no tiene, el elegido o el del primer gato.
  Se conserva aunque se borre la colonia, así el feed del ayuntamiento no pierde historia.
- **Validación sin sorpresas**: si la asociación modifica una acción ya validada, sigue
  validada pero el feed la marca como «Validada · modificada». Si una colonia o acción
  cambia de municipio, su autorización/validación se anula.
- **Propuestas de cambio**: el ayuntamiento envía solo los campos que cambian; se guardan
  los valores anteriores para mostrar el «antes → después». Las aceptan o rechazan los
  administradores de la asociación; al aceptarlas se aplican en la misma transacción.
- **Fotos privadas**: se suben antes de guardar el gato (`POST /api/v1/uploads/photos`,
  tipo detectado por los bytes, máx. 8 MB) y se sirven por la API solo a quien puede ver el
  gato. La clave incluye la organización y se comprueba al guardar.
- **Mapas** con Leaflet + teselas de OpenStreetMap, cargados solo en el navegador.

---

## 3. Base de datos y seguridad

| Migración         | Contenido                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_schema.sql` | Tablas, restricciones, triggers de integridad (misma organización en colonia/gato/acción, participantes miembros, al menos un admin, colonias/gatos/acciones solo de asociaciones) |
| `0002_rls.sql`    | Rol `app_user`, funciones `app_*`, políticas RLS en todas las tablas                                                                                                               |

Resumen de permisos:

| Quién                    | Colonias                           | Gatos / acciones                          | Otros                                                                             |
| ------------------------ | ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Admin de asociación      | Crear, editar, eliminar            | Todo                                      | Invitar, roles, resolver propuestas                                               |
| Miembro de asociación    | Ver                                | Crear, editar; eliminar lo suyo           | Salir de la organización                                                          |
| Ayuntamiento (aprobado)  | Ver las de su municipio, autorizar | Ver los de su municipio; validar acciones | Proponer cambios; sus admins invitan                                              |
| Organización no aprobada | —                                  | —                                         | Solo ve su ficha y su estado                                                      |
| Superadministrador       | —                                  | —                                         | Aprobar/rechazar/suspender, crear ayuntamientos, invitar a cualquier organización |

Todo ello está cubierto por `tests/integration/rls.test.ts` (directamente contra
PostgreSQL) y `tests/integration/api.test.ts` (a través de la API y el cliente tipado).

**RGPD / minimización:** el registro solo pide nombre, email y contraseña. Las ubicaciones
exactas no son públicas. Los nombres de las personas participantes solo los ve su propia
organización (el ayuntamiento ve cuántas son). Los correos de recuperación no revelan si
una cuenta existe.

---

## 4. Estado del MVP

### Implementado y verificado

| Funcionalidad                                                                                    | Cómo se verificó              |
| ------------------------------------------------------------------------------------------------ | ----------------------------- |
| Registro, inicio/cierre de sesión, rutas privadas (la recuperación de contraseña no ha cambiado) | E2E                           |
| Alta de asociación pendiente → aprobación del superadmin (con aviso por email en ambos sentidos) | Integración API + E2E         |
| Alta de ayuntamiento por el superadmin + invitación; uno por municipio                           | Integración (RLS y API) + E2E |
| Invitaciones por email (solo para el email invitado, una organización por persona)               | Integración                   |
| Equipo: roles, bajas, salir; siempre queda un admin                                              | Integración                   |
| Colonias con mapa, municipio INE y dirección; lista y vista de mapa                              | E2E                           |
| Gatos con foto (subida y servida con control de acceso), colonia opcional, fecha aproximada      | Integración + E2E             |
| Acciones con tipo, estado, urgencia, gatos y participantes; «castrado» derivado de las acciones  | Integración + E2E             |
| Feed del ayuntamiento, validación y «modificada tras validar»                                    | Integración + E2E             |
| Autorización de colonias por el ayuntamiento                                                     | Integración + E2E             |
| Propuestas de cambio (colonia y gato): crear, aceptar (aplica cambios), rechazar, retirar        | Integración + E2E             |
| Aislamiento entre asociaciones y entre municipios                                                | `rls.test.ts` + `api.test.ts` |
| Recordatorios diarios sin duplicados                                                             | Integración                   |
| Responsive (menú lateral → hoja, sin scroll horizontal)                                          | E2E móvil (Pixel 7)           |
| `vp check`, `vp test`, `vp run build`                                                            | Sin errores                   |

### Limitaciones conocidas

- **Resend no se ha probado con una clave real.** Configúralo y prueba con una invitación.
- Las teselas de `tile.openstreetmap.org` sirven para uso ligero; con tráfico real usa un
  proveedor de teselas propio o de pago (cambia la URL en `LocationMap.tsx`).
- No hay geocodificación: el municipio se elige a mano aunque el punto ya esté en el mapa.
- No hay registro de actividad (auditoría) más allá de fechas y autores de cada cambio.
- Los ayuntamientos no pueden registrar acciones propias (p. ej. campañas municipales).
- La API no tiene autenticación por token para apps nativas (plugin `bearer` de Better Auth).

### Siguientes pasos recomendados

1. Geocodificación inversa (sugerir municipio y dirección a partir del punto del mapa).
2. Avisos al ayuntamiento de acciones urgentes nuevas y resumen semanal del feed.
3. Más fotos por gato y fotos en las acciones (antes/después de una castración).
4. Exportación CSV/PDF para memorias e informes municipales (castraciones por colonia y año).
5. Historial de cambios de colonias y gatos.
