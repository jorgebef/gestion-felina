import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, MailPlus, PauseCircle, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  ORGANIZATION_KIND_LABELS,
  type MemberRole,
  type OrganizationStatus,
} from "@felina/domain/felina";
import { invitationInputSchema } from "@felina/schemas/organization";

import { APP_NAME } from "@/components/brand/Logo";
import { Facts, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { adminOrganizationQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin/$orgId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(adminOrganizationQuery(params.orgId)),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.organization.name ?? "Organización"} · ${APP_NAME}` }],
  }),
  component: AdminOrganization,
});

function AdminOrganization() {
  const { orgId } = Route.useParams();
  const { data, isFetching } = useSuspenseQuery(adminOrganizationQuery(orgId));
  const queryClient = useQueryClient();
  const [note, setNote] = useState(data.organization.reviewNote ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("admin");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const org = data.organization;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const review = useMutation({
    mutationFn: (status: OrganizationStatus) =>
      api().admin.review(orgId, { status, note: note.trim() || null }),
    onSuccess: async () => {
      toast.success("Estado actualizado; se ha avisado a sus administradores");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const invite = useMutation({
    mutationFn: () => {
      const parsed = invitationInputSchema.safeParse({ email, role });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api().admin.invite(orgId, parsed.data);
    },
    onSuccess: async (result) => {
      toast.success(
        result.emailSent ? `Invitación enviada a ${email}` : "Invitación creada (email no enviado)",
      );
      setEmail("");
      await refresh();
    },
    onError: (e) =>
      setInviteError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e)),
  });

  const reviewButton = (
    status: OrganizationStatus,
    label: string,
    icon: React.ReactNode,
    variant: "default" | "outline" = "outline",
  ) => (
    <Button
      variant={variant}
      className={variant === "outline" ? "bg-card" : undefined}
      onClick={() => review.mutate(status)}
      disabled={review.isPending}
    >
      {review.isPending && review.variables === status ? (
        <Loader2 className="animate-spin" />
      ) : (
        icon
      )}
      {label}
    </Button>
  );

  return (
    <>
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Organizaciones
      </Link>
      <PageHeader
        eyebrow={ORGANIZATION_KIND_LABELS[org.kind]}
        title={org.name}
        description={org.municipalityName ?? undefined}
        actions={<OrganizationStatusBadge status={org.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <Facts
              items={[
                { label: "CIF", value: org.taxId ?? "—" },
                { label: "Email de contacto", value: org.contactEmail ?? "—" },
                { label: "Teléfono", value: org.contactPhone ?? "—" },
                { label: "Alta", value: formatDateTime(org.createdAt) },
                {
                  label: "Última revisión",
                  value: org.reviewedAt ? formatDateTime(org.reviewedAt) : "—",
                },
              ]}
            />
            {org.description ? (
              <p className="mt-4 text-sm whitespace-pre-line">{org.description}</p>
            ) : null}
          </section>

          <section className="surface">
            <h2 className="border-b px-5 py-3 font-semibold">
              Miembros{isFetching ? null : ` (${data.members.length})`}
            </h2>
            {isFetching ? (
              <RowsSkeleton framed={false} rows={2} trailing label="Cargando miembros…" />
            ) : data.members.length ? (
              <ul className="divide-y text-sm">
                {data.members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between gap-3 px-5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.name || m.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.email}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {MEMBER_ROLE_LABELS[m.role]} · {formatDate(m.joinedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Nadie ha aceptado todavía la invitación.
              </p>
            )}
            {!isFetching && data.invitations.length ? (
              <div className="border-t px-5 py-3">
                <h3 className="text-sm font-medium">Invitaciones abiertas</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {data.invitations.map((i) => (
                    <li key={i.id}>
                      {i.email} · {MEMBER_ROLE_LABELS[i.role]} · caduca el {formatDate(i.expiresAt)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface space-y-4 p-5">
            <h2 className="font-semibold">Revisión</h2>
            <Field
              id="note"
              label="Nota para la organización"
              optional
              hint="Se incluye en el email."
            >
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-card"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {org.status !== "approved"
                ? reviewButton(
                    "approved",
                    org.status === "suspended" ? "Reactivar" : "Aprobar",
                    org.status === "suspended" ? <RotateCcw /> : <Check />,
                    "default",
                  )
                : null}
              {org.status === "pending" ? reviewButton("rejected", "Rechazar", <X />) : null}
              {org.status === "approved"
                ? reviewButton("suspended", "Suspender", <PauseCircle />)
                : null}
              {org.status === "rejected"
                ? reviewButton("pending", "Volver a pendiente", <RotateCcw />)
                : null}
            </div>
          </section>

          <section className="surface space-y-4 p-5">
            <h2 className="font-semibold">Invitar a esta organización</h2>
            <form
              noValidate
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setInviteError(null);
                invite.mutate();
              }}
            >
              <Field id="admin-invite-email" label="Email">
                <Input
                  id="admin-invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-card"
                />
              </Field>
              <Field id="admin-invite-role" label="Rol">
                <Select
                  items={MEMBER_ROLE_LABELS}
                  value={role}
                  onValueChange={(v) => v && setRole(v)}
                >
                  <SelectTrigger id="admin-invite-role" className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {MEMBER_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <FormError message={inviteError} />
              <Button type="submit" disabled={invite.isPending || !email.trim()}>
                {invite.isPending ? <Loader2 className="animate-spin" /> : <MailPlus />}
                Enviar invitación
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
