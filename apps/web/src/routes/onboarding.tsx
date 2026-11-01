import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Clock, LogOut, MailOpen, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";

import { APP_NAME, Logo } from "@/components/brand/Logo";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { emptyOrganization, OrganizationForm } from "@/components/forms/OrganizationForm";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { viewerQuery } from "@/lib/queries";

/**
 * Signed-in people without an approved organization: register an association, or wait
 * for approval. Town halls only join through an invitation.
 */
export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) throw redirect({ to: "/login", search: { redirect: location.href } });
    if (context.viewer.membership?.organization.status === "approved") {
      throw redirect({ to: "/panel" });
    }
    return { viewer: context.viewer };
  },
  head: () => ({ meta: [{ title: `Bienvenida · ${APP_NAME}` }] }),
  component: Onboarding,
});

function Onboarding() {
  const { viewer } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    await router.invalidate();
    await router.navigate({ to: "/" });
  };

  const membership = viewer.membership;
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/perfil">
                <UserRound /> Mi perfil
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut /> Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {viewer.isPlatformAdmin ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-brand-strong">
              <ShieldCheck className="size-4" /> Eres superadministrador/a de la plataforma.
            </span>
            <Button asChild size="sm">
              <Link to="/admin">Ir a la administración</Link>
            </Button>
          </div>
        ) : null}

        {membership ? (
          <section className="surface p-6">
            <div className="flex items-center gap-3">
              {membership.organization.status === "pending" ? (
                <Clock className="size-6 text-warning" />
              ) : (
                <ShieldAlert className="size-6 text-negative" />
              )}
              <h1 className="text-xl font-semibold tracking-tight">
                {membership.organization.name}
              </h1>
              <OrganizationStatusBadge status={membership.organization.status} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {membership.organization.status === "pending"
                ? "Hemos recibido la solicitud. La revisamos manualmente y te avisaremos por email en cuanto esté aprobada."
                : membership.organization.status === "rejected"
                  ? "La solicitud no se ha aprobado."
                  : "La organización está suspendida. Mientras tanto no se puede acceder a sus datos."}
            </p>
            {membership.organization.reviewNote ? (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
                Nota del equipo: {membership.organization.reviewNote}
              </p>
            ) : null}
            <Button
              variant="outline"
              className="mt-5 bg-card"
              onClick={async () => {
                await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
                await router.invalidate();
              }}
            >
              Comprobar de nuevo
            </Button>
          </section>
        ) : (
          <>
            <p className="eyebrow">Hola, {viewer.user.name || viewer.user.email}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Registra tu asociación</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisamos cada solicitud a mano. Cuando esté aprobada podrás registrar colonias, gatos
              y acciones e invitar a tu equipo.
            </p>
            <div className="mt-4 flex gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              <MailOpen className="mt-0.5 size-4 shrink-0 text-brand" />
              <p>
                ¿Te han invitado a una asociación o eres de un ayuntamiento? No registres nada: abre
                el enlace de la invitación que te llegó por email (con este mismo email,{" "}
                <strong className="text-foreground">{viewer.user.email}</strong>).
              </p>
            </div>
            <div className="surface mt-6 p-5 sm:p-6">
              <OrganizationForm
                withMunicipality
                initial={emptyOrganization}
                submitLabel="Enviar solicitud"
                onSubmit={async (values) => {
                  await api().organizations.register(values);
                  await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
                  await router.invalidate();
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
