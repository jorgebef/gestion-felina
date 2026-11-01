import { Link } from "@tanstack/react-router";
import { Landmark, MapPinned, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";

const POINTS = [
  {
    icon: MapPinned,
    title: "Colonias y gatos, ubicados",
    body: "Ficha de cada gato con su foto, su colonia y todas las acciones realizadas.",
  },
  {
    icon: Landmark,
    title: "Coordinación con tu ayuntamiento",
    body: "El ayuntamiento autoriza colonias, valida acciones y propone cambios.",
  },
  {
    icon: ShieldCheck,
    title: "Datos protegidos",
    body: "Cada asociación solo ve lo suyo. Las ubicaciones exactas no son públicas.",
  },
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      <section className="flex flex-col px-4 py-6 sm:px-10">
        <Link to="/" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </section>
      <aside className="hidden border-l bg-brand-strong p-10 text-white lg:flex lg:flex-col lg:justify-center">
        <p className="max-w-sm text-2xl leading-snug font-semibold tracking-tight">
          Gestión de colonias felinas para asociaciones y ayuntamientos.
        </p>
        <ul className="mt-10 grid max-w-sm gap-6">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <p.icon className="mt-0.5 size-5 shrink-0 text-white/70" />
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-white/70">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
