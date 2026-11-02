import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LogOut, MailPlus, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import { MEMBER_ROLE_LABELS, type MemberRole } from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { formatDate } from "@felina/client/format";
import { invitationInputSchema } from "@felina/schemas/organization";

import { Screen } from "@/components/app/screen";
import { RowsSkeleton } from "@/components/app/skeletons";
import { ErrorState, SectionTitle } from "@/components/app/states";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { invitationsQuery, membersQuery } from "@/lib/queries";
import { refreshViewer, useMembership } from "@/lib/session";
import { cn } from "@/lib/utils";

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
    <View className="gap-3">
      <Field label="Email" error={error ?? undefined}>
        <Input
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="voluntaria@ejemplo.org"
          accessibilityLabel="Email"
        />
      </Field>
      <Field label="Rol">
        <Select value={role} items={MEMBER_ROLE_LABELS} onValueChange={setRole} />
      </Field>
      <Button
        icon={MailPlus}
        loading={invite.isPending}
        disabled={!email.trim()}
        onPress={() => {
          setError(null);
          invite.mutate();
        }}
      >
        Invitar
      </Button>
    </View>
  );
}

export default function Team() {
  const { viewer, organization, isAdmin } = useMembership();
  const members = useQuery(membersQuery);
  const invitations = useQuery({ ...invitationsQuery, enabled: isAdmin });
  const queryClient = useQueryClient();
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
        await refreshViewer(queryClient);
        router.replace("/");
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
    <Screen onRefresh={() => Promise.all([members.refetch(), invitations.refetch()])}>
      <Text className="text-sm text-muted-foreground">
        Personas de {organization.name}. Cada persona solo puede pertenecer a una organización.
      </Text>

      {isAdmin ? (
        <Card className="gap-4 p-5">
          <View className="gap-1">
            <SectionTitle>Invitar a alguien</SectionTitle>
            <Text className="text-sm text-muted-foreground">
              Recibirá un enlace por email. Los administradores gestionan colonias, el equipo y las
              propuestas del ayuntamiento.
            </Text>
          </View>
          <InviteForm />
          {invitations.isFetching ? (
            <RowsSkeleton rows={2} label="Cargando invitaciones…" />
          ) : invitations.data?.length ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Invitaciones pendientes</Text>
              <Card>
                {invitations.data.map((inv, i) => (
                  <View
                    key={inv.id}
                    className={cn(
                      "flex-row items-center justify-between gap-3 px-3 py-2",
                      i > 0 && "border-t border-border",
                    )}
                  >
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-sm text-foreground">
                        {inv.email}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {MEMBER_ROLE_LABELS[inv.role]} · caduca el {formatDate(inv.expiresAt)}
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={X}
                      disabled={revoke.isPending}
                      onPress={() => revoke.mutate(inv.id)}
                    >
                      Anular
                    </Button>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </Card>
      ) : null}

      <View className="gap-3">
        <SectionTitle>Miembros</SectionTitle>
        {members.isPending || members.isFetching ? (
          <RowsSkeleton rows={3} label="Cargando miembros…" />
        ) : members.isError ? (
          <ErrorState error={members.error} />
        ) : (
          <Card>
            {members.data.map((m, i) => {
              const me = m.userId === viewer.user.id;
              return (
                <View
                  key={m.userId}
                  className={cn("gap-2 px-4 py-3", i > 0 && "border-t border-border")}
                >
                  <View className="flex-row items-center gap-2">
                    <Text
                      numberOfLines={1}
                      className="shrink text-base font-medium text-foreground"
                    >
                      {m.name || m.email}
                    </Text>
                    {me ? <Pill tone="muted">Tú</Pill> : null}
                  </View>
                  <Text numberOfLines={1} className="text-xs text-muted-foreground">
                    {m.email} · desde {formatDate(m.joinedAt)}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {isAdmin ? (
                      <Select
                        className="flex-1"
                        value={m.role}
                        items={MEMBER_ROLE_LABELS}
                        disabled={setRole.isPending}
                        onValueChange={(role) => setRole.mutate({ userId: m.userId, role })}
                      />
                    ) : (
                      <Pill>{MEMBER_ROLE_LABELS[m.role]}</Pill>
                    )}
                    {isAdmin || me ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        icon={me ? LogOut : Trash2}
                        accessibilityLabel={
                          me ? "Salir de la organización" : `Eliminar a ${m.email}`
                        }
                        onPress={async () => {
                          const ok = await confirm({
                            title: me
                              ? "¿Salir de la organización?"
                              : `¿Eliminar a ${m.name || m.email}?`,
                            message: me
                              ? "Dejarás de ver sus colonias, gatos y acciones. Necesitarás una nueva invitación para volver."
                              : "Dejará de tener acceso. Lo que haya registrado se conserva.",
                            confirmLabel: me ? "Salir" : "Eliminar",
                          });
                          if (ok) remove.mutate(m.userId);
                        }}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </Screen>
  );
}
