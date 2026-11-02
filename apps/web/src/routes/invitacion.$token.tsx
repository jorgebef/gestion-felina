import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2, MailOpen } from "lucide-react";

import { MEMBER_ROLE_LABELS, ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";

import { APP_NAME, Logo } from "@/components/brand/Logo";
import { ErrorState } from "@/components/app/states";
import { EntityAvatar } from "@/components/felina/EntityAvatar";
import { FormError } from "@/components/forms/Field";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { invitationQuery, viewerQuery } from "@/lib/queries";

export const Route = createFileRoute("/invitacion/$token")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(invitationQuery(params.token)),
  head: () => ({ meta: [{ title: `Invitación · ${APP_NAME}` }] }),
  errorComponent: ({ error }) => (
    <Shell>
      <ErrorState error={error} />
    </Shell>
  ),
  component: InvitationPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link to="/" className="mb-8 w-fit">
        <Logo />
      </Link>
      {children}
    </main>
  );
}

function InvitationPage() {
  const { token } = Route.useParams();
  const { viewer } = Route.useRouteContext();
  const { data: invitation } = useSuspenseQuery(invitationQuery(token));
  const router = useRouter();
  const queryClient = useQueryClient();
  const href = `/invitacion/${token}`;

  const accept = useMutation({
    mutationFn: () => api().invitations.accept(token),
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
      await router.invalidate();
      await router.navigate({ to: "/panel" });
    },
  });

  const wrongAccount = viewer && viewer.user.email.toLowerCase() !== invitation.email;
  const alreadyMember = viewer?.membership;

  return (
    <Shell>
      <div className="surface p-6">
        <div className="flex items-center gap-3">
          <EntityAvatar
            entity={{
              kind: invitation.organizationKind,
              id: invitation.organizationId,
              avatar: invitation.organizationAvatar,
            }}
            name={invitation.organizationName}
            size="lg"
          />
          <MailOpen className="size-5 text-brand" />
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Invitación a {invitation.organizationName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ORGANIZATION_KIND_LABELS[invitation.organizationKind]} · rol{" "}
          {MEMBER_ROLE_LABELS[invitation.role].toLowerCase()} · para{" "}
          <strong className="text-foreground">{invitation.email}</strong>
        </p>

        {invitation.state !== "valid" ? (
          <p className="mt-5 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            {invitation.state === "accepted"
              ? "Esta invitación ya se ha usado."
              : invitation.state === "expired"
                ? "La invitación ha caducado. Pide que te envíen una nueva."
                : "La invitación ya no es válida. Pide que te envíen una nueva."}
          </p>
        ) : !viewer ? (
          <div className="mt-6 grid gap-2">
            <Link
              to="/login"
              search={{ mode: "signup", redirect: href }}
              className={buttonVariants()}
            >
              Crear cuenta con {invitation.email}
            </Link>
            <Link
              to="/login"
              search={{ redirect: href }}
              className={cn(buttonVariants({ variant: "outline" }), "bg-card")}
            >
              Ya tengo cuenta
            </Link>
          </div>
        ) : wrongAccount ? (
          <p className="mt-5 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            Has iniciado sesión como {viewer.user.email}. Cierra sesión y entra con{" "}
            {invitation.email} para aceptarla.
          </p>
        ) : alreadyMember ? (
          <p className="mt-5 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            Ya perteneces a {alreadyMember.organization.name}. Cada persona solo puede estar en una
            organización.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <FormError message={accept.error ? errorMessage(accept.error) : null} />
            <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
              {accept.isPending ? <Loader2 className="animate-spin" /> : null}
              Aceptar y unirme
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
