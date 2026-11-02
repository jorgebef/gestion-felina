import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Cat,
  ClipboardList,
  GitPullRequestArrow,
  Landmark,
  MapPinned,
  ShieldCheck,
  Users,
} from "lucide-react";

import { APP_NAME, Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: `${APP_NAME} · Gestión de colonias felinas` }] }),
  component: Landing,
});

const ASSOCIATION_FEATURES = [
  {
    icon: MapPinned,
    title: "Colonias en el mapa",
    body: "Cada colonia con su ubicación exacta, municipio y dirección.",
  },
  {
    icon: Cat,
    title: "Ficha de cada gato",
    body: "Foto, sexo, fecha de nacimiento (aunque sea aproximada) y su historial.",
  },
  {
    icon: ClipboardList,
    title: "Acciones del equipo",
    body: "Castraciones, veterinario, capturas, sueltas o alimentación, con fecha, participantes y urgencia.",
  },
  {
    icon: Users,
    title: "Tu equipo",
    body: "Invita a voluntarias y voluntarios; los administradores gestionan colonias y permisos.",
  },
];

const TOWN_HALL_FEATURES = [
  {
    icon: BadgeCheck,
    title: "Autoriza colonias",
    body: "Ve todas las colonias de tu municipio y márcalas como autorizadas.",
  },
  {
    icon: ClipboardList,
    title: "Feed de acciones",
    body: "Cada acción en una colonia de tu municipio llega a tu feed para validarla.",
  },
  {
    icon: GitPullRequestArrow,
    title: "Propón cambios",
    body: "No editas datos de nadie: propones cambios y la asociación gestora los acepta.",
  },
];

function Landing() {
  const { viewer } = Route.useRouteContext();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="page-container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2">
            {viewer ? (
              <Link to="/panel" className={buttonVariants()}>
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonVariants({ variant: "ghost" })}>
                  Iniciar sesión
                </Link>
                <Link to="/login" search={{ mode: "signup" }} className={buttonVariants()}>
                  Registrar asociación
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="page-container py-16 sm:py-24">
          <p className="eyebrow">Para asociaciones felinas y ayuntamientos</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Las colonias felinas de tu municipio, gestionadas y coordinadas en un solo sitio.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Las asociaciones registran colonias, gatos y acciones. El ayuntamiento las autoriza,
            valida lo que se hace y propone cambios. Cada organización se aprueba manualmente antes
            de empezar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className={buttonVariants({ size: "lg" })}
            >
              Registrar mi asociación
            </Link>
            <Link
              to="/login"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "bg-card")}
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="page-container grid gap-10 py-14 lg:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="size-5 text-brand" /> Asociaciones
              </h2>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {ASSOCIATION_FEATURES.map((f) => (
                  <li key={f.title}>
                    <f.icon className="size-5 text-brand" />
                    <p className="mt-2 font-medium">{f.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Landmark className="size-5 text-brand" /> Ayuntamientos
              </h2>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {TOWN_HALL_FEATURES.map((f) => (
                  <li key={f.title}>
                    <f.icon className="size-5 text-brand" />
                    <p className="mt-2 font-medium">{f.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                Los ayuntamientos no se registran: los damos de alta nosotros (uno por municipio) y
                enviamos la invitación a la persona responsable.
              </p>
            </div>
          </div>
        </section>

        <section className="page-container flex items-start gap-3 py-12 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
          <p className="max-w-2xl">
            Las ubicaciones exactas de las colonias no son públicas: solo las ven la asociación
            gestora y el ayuntamiento del municipio. Cada asociación ve únicamente sus datos.
          </p>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="page-container text-sm text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}
        </div>
      </footer>
    </div>
  );
}
