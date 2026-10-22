# PROYECTO: Desarrollo del MVP de una plataforma SaaS de licitaciones públicas en España

## 1. Tu función

Actúa como un equipo senior de desarrollo de software compuesto por:

- Arquitecto de software.
- Desarrollador full-stack especializado en Tanstack Start, React, TypeScript y PostgreSQL.
- Ingeniero de bases de datos y sistemas de ingesta de datos.
- Diseñador de producto y UX/UI especializado en aplicaciones SaaS B2B.
- Ingeniero de seguridad y testing.

Tu objetivo es **construir la primera versión funcional de una aplicación web SaaS destinada a empresas y profesionales que quieran encontrar y seguir licitaciones públicas en España**.

No quiero únicamente una propuesta de arquitectura, ejemplos de código ni pantallas visuales estáticas. Quiero una aplicación real, ejecutable, conectada a una base de datos y preparada para continuar desarrollándose.

Prioriza código mantenible, modularidad, seguridad y una experiencia de usuario excelente.

Trabaja con autonomía para resolver decisiones técnicas razonables y explícame las decisiones importantes.

Si tienes acceso al repositorio, sistema de archivos y terminal, utiliza esas herramientas para crear, ejecutar y probar el proyecto. No te limites a describir cómo se implementaría.

---

## 2. Contexto del negocio

Estoy desarrollando una plataforma de inteligencia y seguimiento de contratación pública española.

El público objetivo son:

- Autónomos.
- Pymes.
- Empresas constructoras.
- Empresas de mantenimiento e instalaciones.
- Empresas de suministros.
- Consultoras y empresas de servicios.
- Profesionales interesados en obtener contratos públicos.

El problema que queremos resolver es que muchas empresas no saben cómo localizar licitaciones públicas relevantes, tienen dificultades para entender qué oportunidades encajan con sus actividades y no disponen de tiempo para revisar diariamente las plataformas oficiales.

La plataforma debe facilitar ese trabajo.

### Propuesta principal de valor

**El usuario describe qué hace su empresa, dónde trabaja y qué tipo de contratos le interesan. Nuestra plataforma identifica licitaciones relevantes y le notifica automáticamente cuando aparecen nuevas oportunidades.**

Posteriormente, el usuario podrá investigar esas licitaciones, guardarlas, seguirlas y gestionar los plazos de presentación.

A largo plazo se incorporarán funcionalidades de inteligencia artificial, preparación documental, análisis avanzado y servicios de asesoramiento profesional.

Pero NO debes construir todas esas funcionalidades ahora.

---

## 3. Alcance del MVP

Quiero comenzar por seis funcionalidades esenciales.

### Módulo A. Autenticación y gestión de empresas

Implementar:

1. Registro de usuarios mediante correo electrónico y contraseña.
2. Inicio y cierre de sesión.
3. Recuperación de contraseña.
4. Creación de un perfil de empresa durante el onboarding.
5. Edición de los datos de la empresa.
6. Relación entre empresas y usuarios.
7. Protección de rutas privadas.

La aplicación debe estar preparada para que una empresa pueda tener varios usuarios en el futuro, aunque inicialmente basta con un propietario que administre su cuenta.

No solicitar información innecesaria durante el registro.

### Módulo B. Configuración de perfiles de alertas

Esta es una de las funcionalidades más importantes.

El usuario debe poder configurar qué tipos de licitaciones quiere recibir.

Permitir definir:

- Nombre del perfil de alerta.
- Descripción de los servicios que ofrece la empresa.
- Sectores y actividades.
- Códigos CPV relevantes.
- Palabras clave que deben incluirse.
- Palabras clave que deben excluirse.
- Provincias donde puede ejecutar contratos.
- Posibilidad de buscar en toda España.
- Tipo de contrato.
- Presupuesto mínimo.
- Presupuesto máximo.
- Frecuencia de notificaciones.
- Activación y desactivación del perfil.

Una empresa puede tener varios perfiles de alerta independientes.

La configuración debe ser sencilla para usuarios sin conocimientos de contratación pública.

No obligues al usuario a conocer los códigos CPV. Diseña el formulario para poder trabajar inicialmente con descripciones en lenguaje natural y permitir la selección manual de CPV.

Si se implementan sugerencias automáticas de CPV, deben mostrarse como propuestas editables, no como clasificaciones definitivas.

### Módulo C. Base de datos y búsqueda de licitaciones

Utiliza el archivo SQL adjunto como punto de partida para construir la base de datos.

Debes respetar la estructura existente y comprender las relaciones entre las tablas.

Las entidades principales son:

- `users`
- `companies`
- `company_members`
- `alert_profiles`
- `contracting_authorities`
- `tenders`
- `tender_lots`
- `tender_sources`
- `tender_events`
- `tender_matches`
- `tracked_tenders`
- `tender_tasks`
- `notification_deliveries`
- `company_subscriptions`

La aplicación debe permitir consultar las licitaciones almacenadas y filtrarlas por:

- Palabras clave.
- Título y descripción.
- Código CPV.
- Tipo de contrato.
- Provincia de ejecución.
- Organismo de contratación.
- Presupuesto.
- Fecha de publicación.
- Fecha límite de presentación.
- Estado de la licitación.

Mostrar los resultados ordenados por fecha o relevancia.

Implementar paginación para evitar cargar todos los registros simultáneamente.

Cada licitación debe tener una página de detalle con sus principales datos, lotes disponibles, organismo de contratación, cambios publicados y enlace al expediente oficial.

Distinguir claramente el presupuesto base de licitación sin IVA del valor estimado del contrato.

### Módulo D. Importación de datos públicos

La aplicación debe poder importar licitaciones procedentes de fuentes oficiales españolas.

La primera integración debe centrarse en los conjuntos de datos oficiales de la Plataforma de Contratación del Sector Público (PLACSP).

Priorizar las fuentes públicas estructuradas XML/ATOM y los conjuntos de datos abiertos frente al scraping mediante navegador.

Diseñar la ingesta mediante una arquitectura de conectores independientes, para incorporar posteriormente otras fuentes:

- Plataformas de contratación autonómicas.
- TED (Tenders Electronic Daily).
- Boletín Oficial del Estado.
- Boletines provinciales.
- Otras fuentes oficiales autorizadas.

Para la primera versión, implementar únicamente un conector PLACSP funcional y verificable.

Requisitos del importador:

1. Obtener registros desde una fuente oficial real y documentada.
2. Interpretar los datos recibidos.
3. Normalizar los campos al esquema de PostgreSQL.
4. Crear nuevas licitaciones cuando corresponda.
5. Actualizar registros existentes.
6. Evitar duplicados mediante identificadores externos estables.
7. Registrar la procedencia de cada registro.
8. Conservar la información necesaria para auditar la importación.
9. Detectar modificaciones relevantes.
10. Registrar errores sin interrumpir toda la importación.
11. Poder ejecutar importaciones sucesivas de forma idempotente.
12. Mostrar cuándo se realizó la última importación y su resultado.

No inventes URLs, APIs, nombres de campos oficiales ni formatos de respuesta. Comprueba las especificaciones reales de la fuente.

Si durante el desarrollo no puedes acceder a las fuentes externas, crea un adaptador desacoplado y utiliza fixtures basados en la estructura documentada, identificándolos explícitamente como datos de desarrollo.

Nunca mezcles registros ficticios con resultados reales sin identificarlos.

Distingue entre expedientes, anuncios, lotes y modificaciones. Un nuevo anuncio sobre un expediente existente no tiene por qué representar una nueva licitación.

### Módulo E. Motor de coincidencias y alertas

Implementar un primer motor de matching sencillo y determinista.

Debe comparar cada licitación con los perfiles de alerta de las empresas.

Factores que pueden intervenir:

- Coincidencia de CPV.
- Coincidencia de palabras clave.
- Similitud textual básica.
- Provincia de ejecución.
- Tipo de contrato.
- Presupuesto.
- Estado y vigencia de la licitación.

Utilizar inicialmente reglas transparentes y un sistema de puntuación configurable entre 0 y 100.

El motor debe generar una explicación de por qué se considera relevante cada licitación.

Importante:

**La puntuación refleja la relevancia para la empresa, no la probabilidad de adjudicación ni la elegibilidad legal para participar.**

No utilizar modelos de IA de pago para todas las operaciones del sistema.

Construir primero un algoritmo eficiente y barato, preparado para incorporar matching semántico en una fase posterior.

Guardar los resultados en `tender_matches`.

### Módulo F. Notificaciones por correo electrónico

Los usuarios deben poder recibir avisos de nuevas oportunidades.

Implementar:

- Resumen diario de licitaciones relevantes.
- Preferencias de notificación por perfil.
- Enlaces directos a los expedientes.
- Registro de notificaciones enviadas.
- Prevención de notificaciones duplicadas.
- Gestión básica de errores de envío.

Preparar el sistema para soportar más adelante alertas inmediatas y semanales, modificaciones importantes y recordatorios de vencimientos.

Puedes utilizar Resend u otro proveedor de correo transaccional con API estable.

El envío de correos debe realizarse desde el servidor, mediante trabajos programados, nunca directamente desde el navegador.

Usar la tabla `notification_deliveries` para la trazabilidad.

---

## 4. Seguimiento de licitaciones

Cada empresa debe poder guardar licitaciones que le interesen.

Crear una sección llamada **Mis licitaciones**.

Debe permitir:

- Guardar y dejar de seguir una licitación.
- Visualizar las licitaciones guardadas.
- Añadir anotaciones privadas.
- Cambiar el estado interno de seguimiento.
- Consultar los plazos.
- Crear tareas manuales.
- Marcar tareas como completadas.

Los posibles estados internos serán:

- Guardada.
- Evaluando.
- Preparando oferta.
- Oferta presentada.
- Ganada.
- Perdida.
- Archivada.

Estos estados deben mantenerse independientes del estado oficial de la licitación.

No implementar todavía la presentación electrónica de ofertas.

---

## 5. Stack tecnológico

En la medida de lo posible, mantener los paquetes que hay en el repositorio, usar la misma tech stack pero cambiar los componentes y código que sea necesario para cumplir con las funciones.
Mi preferencia es utilizar:

**Frontend**

- Tanstack Start.
- React.
- TypeScript con modo estricto.
- Tailwind CSS.
- Componentes reutilizables, accesibles y consistentes
- Componentes de shadcn/ui cuando fuera posible.

**Backend**

- Servicios separados para importación, matching y notificaciones.
- Validación de entradas mediante Zod.
- Código modular con separación entre acceso a datos, lógica de negocio e interfaces.

**Base de datos**

- PostgreSQL.
- Neon como servicio de base de datos
- Better Auth para autenticación.
- Migraciones SQL versionadas.
- Row Level Security donde corresponda.

**Correos**

- Proveedor transaccional configurable mediante variables de entorno.

**Procesos programados**

- Jobs ejecutados del lado del servidor mediante un sistema de tareas programadas adecuado al entorno de despliegue.

**Testing**

- Pruebas unitarias de las funciones críticas.
- Pruebas de integración de base de datos cuando sea posible.
- Pruebas end-to-end de los flujos principales.

Si detectas una incompatibilidad o una alternativa notablemente mejor, justifica el cambio antes de introducir complejidad adicional.

No añadas microservicios, Kubernetes, colas distribuidas ni infraestructura compleja si no son necesarios para el MVP.

---

## 6. Diseño visual y experiencia de usuario

Quiero una aplicación web moderna, profesional, sencilla y muy rápida.

El diseño debe transmitir confianza, claridad y profesionalidad.

Público objetivo: empresas y profesionales, no consumidores de una aplicación de entretenimiento.

### Características visuales

- Diseño SaaS B2B premium.
- Interfaz limpia y minimalista.
- Fondo claro y elementos bien contrastados.
- Tipografía moderna y fácil de leer.
- Tablas profesionales.
- Tarjetas para los resultados de licitaciones.
- Iconos discretos.
- Buena jerarquía visual.
- Estados vacíos, indicadores de carga y mensajes de error bien diseñados.

Evita diseños excesivamente llamativos, animaciones innecesarias y paneles saturados de métricas ficticias.

### Responsive

La plataforma será exclusivamente una aplicación web.

Debe funcionar correctamente en:

- Ordenadores de escritorio.
- Portátiles.
- Tablets.
- Navegadores móviles.

En escritorio, utilizar navegación lateral y resultados en tablas cuando sea conveniente.

En móviles, adaptar las tablas a tarjetas y simplificar la navegación.

No desarrollar una aplicación nativa para iOS o Android.

### Pantallas principales

1. Página de inicio pública.
2. Registro e inicio de sesión.
3. Onboarding de empresa.
4. Dashboard.
5. Buscador de licitaciones.
6. Página de detalle de licitación.
7. Mis licitaciones.
8. Gestión de perfiles de alertas.
9. Configuración de empresa y usuario.

El dashboard debe mostrar información real procedente de la base de datos:

- Nuevas licitaciones relevantes.
- Número de oportunidades activas.
- Licitaciones guardadas.
- Próximos vencimientos.
- Últimas alertas.

No presentar métricas inventadas como si fueran datos reales.

---

## 7. Arquitectura y organización del proyecto

Quiero una estructura organizada por responsabilidades y funcionalidades.

Separa claramente:

- Componentes visuales.
- Rutas y páginas.
- Autenticación y permisos.
- Servicios de empresa y usuarios.
- Servicios de licitaciones.
- Adaptadores de fuentes públicas.
- Normalización de datos.
- Motor de matching.
- Notificaciones.
- Acceso a PostgreSQL.
- Tipos y esquemas de validación.
- Configuración.
- Pruebas.

Prioriza componentes reutilizables y funciones pequeñas.

Evita archivos enormes que concentren toda la lógica.

No dupliques funciones ni disperses consultas SQL repetidas por las páginas.

La ingesta de licitaciones debe funcionar independientemente de la interfaz web.

La lógica de matching debe poder ejecutarse como proceso programado sin depender de un usuario conectado.

---

## 8. Seguridad

La plataforma gestiona información de varias empresas independientes.

Es imprescindible implementar correctamente la separación entre clientes.

Requisitos:

1. Un usuario no puede leer datos privados de otra empresa.
2. Un usuario no puede modificar perfiles de alerta de empresas ajenas.
3. Las anotaciones y tareas son privadas de cada empresa.
4. Las operaciones sensibles se validan en el servidor.
5. Los endpoints internos de importación y notificaciones requieren autorización.
6. No se exponen claves privadas en el frontend.
7. Las políticas de acceso deben respetar las relaciones de `company_members`.
8. No debe ser posible autoconcederse privilegios de administrador o propietario.
9. No debe ser posible modificar el estado de una suscripción desde el navegador.

Utiliza Better Auth y configura adecuadamente la relación con la tabla pública `users` definida en el SQL adjunto.

El archivo SQL existente no incluye todas las políticas RLS necesarias. Créales una migración adicional en lugar de modificar destructivamente el esquema original.

Las licitaciones públicas pueden compartirse entre clientes, pero los perfiles, coincidencias, seguimientos y notificaciones de cada empresa deben permanecer aislados.

Aplica principios de minimización de datos personales y una estructura preparada para cumplir el RGPD.

---

## 9. Uso obligatorio del SQL adjunto

Te proporciono un archivo SQL llamado:

`licitaciones_mvp_schema.sql`

Debes:

1. Leerlo completamente antes de comenzar.
2. Analizar las 14 tablas y sus relaciones.
3. Utilizarlo como esquema inicial de referencia.
4. Crear las migraciones adicionales imprescindibles para autenticación, seguridad y funcionamiento.
5. No renombrar ni eliminar campos arbitrariamente.
6. No sustituir este esquema por uno simplificado.
7. Mantener los índices y restricciones importantes.
8. Explicar cualquier modificación que sea necesaria.

Ten especialmente en cuenta:

- `tenders` contiene expedientes normalizados.
- `tender_sources` contiene identificadores oficiales de procedencia.
- `tender_events` almacena modificaciones y anuncios.
- `tender_lots` almacena los lotes.
- `alert_profiles` contiene las preferencias de matching.
- `tender_matches` contiene los resultados.
- `tracked_tenders` gestiona el seguimiento privado.
- `notification_deliveries` permite evitar envíos duplicados.

No crees tablas duplicadas que representen entidades ya contempladas.

Puedes añadir campos, índices o tablas auxiliares cuando estén justificados técnicamente.

---

## 10. Qué NO debes implementar todavía

Quiero evitar el sobrealcance del MVP.

No implementar en esta primera versión:

- Aplicaciones móviles nativas.
- Marketplace privado de licitaciones.
- Asistente legal basado en IA.
- Generación automática de ofertas completas.
- Presentación electrónica de ofertas.
- Chatbot complejo.
- Análisis predictivo de adjudicaciones.
- Inteligencia avanzada de competidores.
- Integraciones bancarias.
- Integración con CRM externos.
- Sistema de mensajería interno.
- Gestión avanzada de documentos.
- Sistema completo de reservas y contratación de abogados.

La tabla `company_subscriptions` debe mantenerse para la futura monetización.

Puedes preparar la estructura de planes Free, Starter y Pro, pero no es obligatorio integrar Stripe ni habilitar pagos reales en esta primera iteración.

El objetivo es validar primero el funcionamiento y utilidad de las alertas.

---

## 11. Forma de trabajar

Desarrolla el proyecto de forma incremental.

### Fase 1 — Fundación

- Inspeccionar el repositorio si existe.
- Configurar el proyecto.
- Configurar TypeScript y estilos.
- Preparar PostgreSQL y Better Auth.
- Aplicar el esquema SQL y migraciones.
- Implementar autenticación.
- Crear el layout principal.
- Implementar el onboarding y perfil de empresa.

### Fase 2 — Licitaciones

- Crear las consultas y servicios de licitaciones.
- Implementar el importador oficial inicial.
- Crear búsqueda y filtros.
- Implementar paginación.
- Crear la página de detalle.
- Mostrar los lotes y fuentes oficiales.
- Comprobar que la ingesta no produce duplicados.

### Fase 3 — Perfiles y matching

- Crear y editar perfiles de alerta.
- Implementar reglas de matching.
- Guardar coincidencias.
- Mostrar oportunidades relevantes en el dashboard.
- Permitir valorar si una coincidencia es relevante.

### Fase 4 — Seguimiento y avisos

- Guardar licitaciones.
- Gestionar estados internos.
- Crear tareas.
- Implementar el sistema de notificaciones por correo.
- Evitar notificaciones repetidas.
- Probar la ejecución de los jobs programados.

### Fase 5 — Calidad

- Ejecutar comprobaciones de TypeScript.
- Ejecutar lint y pruebas.
- Probar el recorrido completo del usuario.
- Revisar permisos.
- Resolver errores encontrados.
- Elaborar documentación.

**No te detengas después de describir las fases. Comienza a implementar.**

Avanza por ellas en orden, priorizando que exista un flujo funcional completo antes de añadir características secundarias.

Si el entorno impide finalizar alguna integración externa, deja implementada la interfaz y un adaptador verificable, documenta la limitación concreta y continúa con las funcionalidades que sí puedan completarse.

No declares una funcionalidad como terminada si no has podido ejecutarla o probarla.

---

## 12. Criterios de aceptación

Consideraré que la primera versión está correctamente desarrollada cuando se pueda completar este recorrido:

1. Un usuario entra en la aplicación.
2. Se registra.
3. Crea su empresa.
4. Describe los servicios que presta.
5. Selecciona las provincias en las que trabaja.
6. Configura su presupuesto y tipos de contratos.
7. Guarda su primer perfil de alertas.
8. El sistema dispone de licitaciones importadas desde una fuente real o de un conjunto de desarrollo explícitamente identificado.
9. El motor encuentra oportunidades que encajan con el perfil.
10. El usuario ve esas oportunidades en el dashboard.
11. Puede entrar en el detalle y consultar el enlace oficial.
12. Puede guardar una licitación.
13. Puede crear una tarea asociada a ella.
14. Puede recibir una notificación de prueba cuando el proveedor de correo esté configurado.
15. Puede volver posteriormente y encontrar sus datos persistidos.

Además:

- No hay errores críticos de TypeScript.
- El proyecto compila.
- La aplicación es responsive.
- La seguridad entre empresas está implementada y probada.
- Las importaciones repetidas no duplican expedientes.
- Las notificaciones repetidas no generan envíos duplicados.
- Las funcionalidades reales no dependen de datos simulados no identificados.
- El proyecto dispone de instrucciones claras de instalación.

---

## 13. Entregables

Al finalizar, necesito:

1. Código fuente completo.
2. Estructura de carpetas organizada.
3. Migraciones SQL.
4. Archivo `.env.example` con las variables necesarias, sin credenciales reales.
5. Scripts de desarrollo y ejecución.
6. Scripts o procedimientos para la importación de licitaciones.
7. Tests de las funcionalidades críticas.
8. README con instrucciones de instalación y configuración.
9. Explicación de la arquitectura.
10. Lista de funcionalidades implementadas y verificadas.
11. Lista de funcionalidades pendientes.
12. Recomendaciones para la siguiente iteración.

No quiero únicamente pseudocódigo ni fragmentos aislados.

Los componentes visuales deben estar conectados a su lógica y persistencia reales cuando formen parte del MVP.

---

## 14. Principios fundamentales

Durante todo el desarrollo sigue estas reglas:

**Simplicidad:** Implementa la solución más sencilla que cumpla los requisitos correctamente.

**Modularidad:** Una nueva fuente de contratación debe poder añadirse sin rehacer el resto de la aplicación.

**Escalabilidad razonable:** Prepara la arquitectura para crecer, sin introducir infraestructura innecesaria.

**Costes bajos:** Prioriza soluciones económicas para una startup en fase inicial.

**Fiabilidad:** Las licitaciones y sus plazos proceden de fuentes oficiales. No inventes información.

**Transparencia:** Si una funcionalidad utiliza datos ficticios de desarrollo, indícalo claramente.

**Seguridad:** Ningún cliente debe acceder a información privada de otro.

**Mantenibilidad:** Código limpio, tipado, probado y documentado.

**Experiencia de usuario:** La aplicación debe ser sencilla para alguien que nunca haya participado en una licitación pública.

**Preparación para futuras iteraciones:** No introduzcas decisiones que dificulten incorporar nuevas fuentes, sistemas de pago, análisis semántico o asesoramiento profesional.

---

## 15. Primera instrucción

Ahora:

1. Analiza el archivo SQL adjunto.
2. Inspecciona el proyecto existente, si lo hay.
3. Resume brevemente la arquitectura que vas a utilizar.
4. Identifica las migraciones de seguridad que faltan.
5. Establece el orden inmediato de implementación.
6. **Comienza a crear el proyecto y desarrollar la Fase 1.**

No necesitas solicitar confirmación para decisiones técnicas habituales.

Prioriza entregar software funcional, verificable y fácil de ampliar.

Mi objetivo final es construir un SaaS real que pueda poner a disposición de las primeras empresas clientes y continuar mejorando mediante nuevas iteraciones.
