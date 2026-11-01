import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Bookmark,
  CheckCircle2,
  Database,
  FileSearch,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { APP_NAME, Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatInteger } from "@/lib/format";
import { publicStatsQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  component: Landing,
});

const STEPS = [
  {
    icon: Sparkles,
    title: "Describe tu empresa",
    body: "Con tus palabras: qué haces, en qué provincias trabajas y qué importes te encajan. Los códigos CPV son opcionales.",
  },
  {
    icon: FileSearch,
    title: "Revisamos cada publicación",
    body: "Importamos las licitaciones de la Plataforma de Contratación del Sector Público y las comparamos con tu perfil.",
  },
  {
    icon: BellRing,
    title: "Recibe solo lo relevante",
    body: "Un resumen por correo con cada oportunidad, por qué encaja y el enlace directo al expediente oficial.",
  },
];

const FEATURES = [
  {
    icon: ListChecks,
    title: "Explicaciones claras",
    body: "Cada coincidencia indica qué la ha activado: código CPV, palabras clave, provincia o importe.",
  },
  {
    icon: Bookmark,
    title: "Seguimiento y plazos",
    body: "Guarda licitaciones, cambia su estado interno, añade notas y tareas con fecha.",
  },
  {
    icon: Database,
    title: "Datos oficiales y trazables",
    body: "Cada ficha muestra su procedencia, los anuncios publicados y los cambios detectados.",
  },
  {
    icon: ShieldCheck,
    title: "Privacidad por empresa",
    body: "Tus perfiles, notas y seguimientos están aislados: ningún otro cliente puede verlos.",
  },
];

function Landing() {
  const { viewer } = Route.useRouteContext();
  const stats = useQuery(publicStatsQuery);

  return (
    <div className="min-h-screen bg-card">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="page-container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2">
            {viewer ? (
              <Button asChild>
                <Link to="/dashboard">Ir a mi panel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/login">Iniciar sesión</Link>
                </Button>
                <Button asChild>
                  <Link to="/login" search={{ mode: "signup" }}>
                    Empezar gratis
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-brand-soft/60 to-card">
          <div className="page-container grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow text-brand">Licitaciones públicas en España</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Encuentra los contratos públicos que encajan con tu empresa
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                Dinos qué haces y dónde trabajas. {APP_NAME} revisa a diario las licitaciones
                oficiales y te avisa cuando aparece una oportunidad para ti.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link
                    to={viewer ? "/dashboard" : "/login"}
                    search={viewer ? undefined : { mode: "signup" }}
                  >
                    Crear mi primera alerta <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#como-funciona">Cómo funciona</a>
                </Button>
              </div>
              <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {[
                  "Sin conocimientos previos de contratación",
                  "Pensado para autónomos y pymes",
                  "Avisos diarios o semanales",
                  "Enlace directo al expediente oficial",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-positive" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface p-5 shadow-lg shadow-brand/5">
              <p className="eyebrow">Ahora mismo en la base de datos</p>
              {stats.data ? (
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Licitaciones en plazo</dt>
                    <dd className="tabular mt-1 text-3xl font-semibold">
                      {formatInteger(stats.data.open)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Organismos convocantes</dt>
                    <dd className="tabular mt-1 text-3xl font-semibold">
                      {formatInteger(stats.data.authorities)}
                    </dd>
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Fuente: Plataforma de Contratación del Sector Público
                    {stats.data.lastImportAt
                      ? ` · actualizado ${formatDateTime(stats.data.lastImportAt)}`
                      : ""}
                    .
                  </p>
                </dl>
              ) : (
                <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" />
              )}
              <div className="mt-5 space-y-2 border-t pt-5">
                <p className="text-sm font-medium">Ejemplo de explicación de una coincidencia</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    CPV 90911200 (Servicios de limpieza de edificios): dentro de su código 90910000
                  </li>
                  <li>Palabras clave encontradas: «limpieza»</li>
                  <li>Lugar de ejecución: Sevilla</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Ilustrativo: así se explica cada aviso.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="page-container py-16 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Cómo funciona</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="surface p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                    <s.icon className="size-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">Paso {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y bg-background">
          <div className="page-container grid gap-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="size-5 text-brand" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="page-container py-16 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Empieza en dos minutos. Sin tarjeta.
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            La relevancia que calculamos te ayuda a priorizar; la decisión de presentarte y el
            cumplimiento de requisitos siempre se comprueban en los pliegos oficiales.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link
              to={viewer ? "/dashboard" : "/login"}
              search={viewer ? undefined : { mode: "signup" }}
            >
              Crear cuenta gratis
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t">
        <div className="page-container flex flex-col gap-2 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <span>
            Datos públicos procedentes de la Plataforma de Contratación del Sector Público.
          </span>
        </div>
      </footer>
    </div>
  );
}
