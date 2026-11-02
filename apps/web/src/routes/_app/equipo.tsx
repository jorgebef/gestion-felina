import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2, LogOut, MailPlus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MEMBER_ROLES, MEMBER_ROLE_LABELS, type MemberRole } from "@felina/domain/felina";
import { invitationInputSchema } from "@felina/schemas/organization";

import { APP_NAME } from "@/components/brand/Logo";
import { ErrorState, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { Pill } from "@/components/felina/badges";
import { EntityAvatar } from "@/components/felina/EntityAvatar";
import { InvitationLink } from "@/components/felina/InvitationLink";
import { Field } from "@/components/forms/Field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { invitationsQuery, membersQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/equipo")({
  head: () => ({ meta: [{ title: `Equipo · ${APP_NAME}` }] }),
  component: Team,
});

function InviteForm() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [error, setError] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () => {
      const parsed = invitationInputSchema.safeParse({ email, role });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api().organizations.invite(parsed.data);
    },
    onSuccess: async (result) => {
      toast.success(
        result.emailSent
          ? `Invitación enviada a ${email}`
          : "Invitación creada, pero el email no se pudo enviar",
      );
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: invitationsQuery.queryKey });
    },
    onError: (e) => setError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e)),
  });
  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        invite.mutate();
      }}
    >
      <Field id="invite-email" label="Email" error={error}>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voluntaria@ejemplo.org"
          className="bg-card"
        />
      </Field>
      <Field id="invite-role" label="Rol">
        <Select items={MEMBER_ROLE_LABELS} value={role} onValueChange={(v) => v && setRole(v)}>
          <SelectTrigger id="invite-role" className="w-full bg-card">
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
      <Button type="submit" disabled={invite.isPending || !email.trim()}>
        {invite.isPending ? <Loader2 className="animate-spin" /> : <MailPlus />}
        Invitar
      </Button>
    </form>
  );
}

function Team() {
  const { membership, viewer } = Route.useRouteContext();
  const isAdmin = membership.role === "admin";
  const members = useQuery(membersQuery);
  const invitations = useQuery({ ...invitationsQuery, enabled: isAdmin });
  const queryClient = useQueryClient();
  const router = useRouter();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["organization"] });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      api().organizations.setMemberRole(userId, role),
    onSuccess: async () => {
      toast.success("Rol actualizado");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api().organizations.removeMember(userId),
    onSuccess: async (_, userId) => {
      if (userId === viewer.user.id) {
        queryClient.clear();
        await router.invalidate();
        await router.navigate({ to: "/onboarding" });
        return;
      }
      toast.success("Persona eliminada de la organización");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api().invitations.revoke(id),
    onSuccess: async () => {
      toast.success("Invitación anulada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Equipo"
        description={`Personas de ${membership.organization.name}. Cada persona solo puede pertenecer a una organización.`}
      />
      <div className="max-w-3xl space-y-6">
        {isAdmin ? (
          <section className="surface p-5">
            <h2 className="mb-1 font-semibold">Invitar a alguien</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Recibirá un enlace por email. Los administradores gestionan colonias, el equipo y las
              propuestas del ayuntamiento.
            </p>
            <InviteForm />
            {invitations.isFetching ? (
              <RowsSkeleton
                framed={false}
                trailing
                rows={2}
                label="Cargando invitaciones…"
                className="mt-6 rounded-lg border"
              />
            ) : invitations.data?.length ? (
              <>
                <h3 className="mt-6 text-sm font-medium">Invitaciones pendientes</h3>
                <ul className="mt-2 divide-y rounded-lg border text-sm">
                  {invitations.data.map((inv) => (
                    <li key={inv.id} className="space-y-2 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          {/* Not a member yet: no photo. */}
                          <EntityAvatar
                            entity={{ kind: "user", id: null, avatar: null }}
                            name={inv.email}
                          />
                          <span className="min-w-0">
                            <span className="block truncate">{inv.email}</span>
                            <span className="text-xs text-muted-foreground">
                              {MEMBER_ROLE_LABELS[inv.role]} · caduca el {formatDate(inv.expiresAt)}
                            </span>
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revoke.mutate(inv.id)}
                          disabled={revoke.isPending}
                        >
                          <X /> Anular
                        </Button>
                      </div>
                      <InvitationLink url={inv.url} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="surface">
          <h2 className="border-b px-5 py-3 font-semibold">Miembros</h2>
          {members.isPending || members.isFetching ? (
            <RowsSkeleton framed={false} trailing rows={3} label="Cargando miembros…" />
          ) : members.isError ? (
            <ErrorState error={members.error} />
          ) : (
            <ul className="divide-y">
              {members.data.map((m) => {
                const me = m.userId === viewer.user.id;
                return (
                  <li
                    key={m.userId}
                    className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <EntityAvatar
                        entity={{ kind: "user", id: m.userId, avatar: m.avatar }}
                        name={m.name || m.email}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {m.name || m.email} {me ? <Pill tone="muted">Tú</Pill> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.email} · desde {formatDate(m.joinedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <Select
                          items={MEMBER_ROLE_LABELS}
                          value={m.role}
                          onValueChange={(role) =>
                            role && setRole.mutate({ userId: m.userId, role })
                          }
                        >
                          <SelectTrigger className="w-44 bg-card" aria-label={`Rol de ${m.email}`}>
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
                      ) : (
                        <Pill>{MEMBER_ROLE_LABELS[m.role]}</Pill>
                      )}
                      {isAdmin || me ? (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={
                                  me ? "Salir de la organización" : `Eliminar a ${m.email}`
                                }
                              />
                            }
                          >
                            {me ? <LogOut /> : <Trash2 />}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {me
                                  ? "¿Salir de la organización?"
                                  : `¿Eliminar a ${m.name || m.email}?`}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {me
                                  ? "Dejarás de ver sus colonias, gatos y acciones. Necesitarás una nueva invitación para volver."
                                  : "Dejará de tener acceso. Lo que haya registrado se conserva."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove.mutate(m.userId)}>
                                {me ? "Salir" : "Eliminar"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
