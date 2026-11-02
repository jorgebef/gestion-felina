import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Check, MailPlus, PauseCircle, RotateCcw, X, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import {
  MEMBER_ROLE_LABELS,
  ORGANIZATION_KIND_LABELS,
  type MemberRole,
  type OrganizationStatus,
} from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { formatDate, formatDateTime } from "@felina/client/format";
import { invitationInputSchema } from "@felina/schemas/organization";

import { Screen } from "@/components/app/screen";
import { EntityAvatar, EntityLabel } from "@/components/felina/entity-avatar";
import { RowsSkeleton } from "@/components/app/skeletons";
import { ErrorState, Facts, LoadingState, PageHeader, SectionTitle } from "@/components/app/states";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { adminOrganizationQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function AdminOrganization() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const query = useQuery(adminOrganizationQuery(orgId));
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("admin");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const reviewNote = query.data?.organization.reviewNote;
  useEffect(() => setNote(reviewNote ?? ""), [reviewNote]);
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

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { organization: org, members, invitations } = query.data;
  const isFetching = query.isFetching;

  const reviewButton = (
    status: OrganizationStatus,
    label: string,
    icon: LucideIcon,
    variant: "default" | "outline" = "outline",
  ) => (
    <Button
      variant={variant}
      icon={icon}
      loading={review.isPending && review.variables === status}
      disabled={review.isPending}
      onPress={() => review.mutate(status)}
    >
      {label}
    </Button>
  );

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: org.name }} />
      <PageHeader
        avatar={
          <EntityAvatar
            entity={{ kind: org.kind, id: org.id, avatar: org.avatar }}
            name={org.name}
            size="lg"
          />
        }
        eyebrow={ORGANIZATION_KIND_LABELS[org.kind]}
        title={org.name}
        description={org.municipalityName ?? undefined}
        actions={<OrganizationStatusBadge status={org.status} />}
      />

      <Card className="gap-4 p-5">
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
          <Text className="text-sm text-foreground">{org.description}</Text>
        ) : null}
      </Card>

      <Card className="gap-4 p-5">
        <SectionTitle>Revisión</SectionTitle>
        <Field label="Nota para la organización" optional hint="Se incluye en el email.">
          <Input multiline value={note} onChangeText={setNote} accessibilityLabel="Nota" />
        </Field>
        <View className="flex-row flex-wrap gap-2">
          {org.status !== "approved"
            ? reviewButton(
                "approved",
                org.status === "suspended" ? "Reactivar" : "Aprobar",
                org.status === "suspended" ? RotateCcw : Check,
                "default",
              )
            : null}
          {org.status === "pending" ? reviewButton("rejected", "Rechazar", X) : null}
          {org.status === "approved" ? reviewButton("suspended", "Suspender", PauseCircle) : null}
          {org.status === "rejected"
            ? reviewButton("pending", "Volver a pendiente", RotateCcw)
            : null}
        </View>
      </Card>

      <View className="gap-3">
        <SectionTitle>{isFetching ? "Miembros" : `Miembros (${members.length})`}</SectionTitle>
        {isFetching ? (
          <RowsSkeleton rows={2} label="Cargando miembros…" />
        ) : members.length ? (
          <Card>
            {members.map((m, i) => (
              <View
                key={m.userId}
                className={cn(
                  "flex-row items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <EntityAvatar
                  entity={{ kind: "user", id: m.userId, avatar: m.avatar }}
                  name={m.name || m.email}
                />
                <View className="flex-1 gap-0.5">
                  <Text numberOfLines={1} className="text-base font-medium text-foreground">
                    {m.name || m.email}
                  </Text>
                  <Text numberOfLines={1} className="text-xs text-muted-foreground">
                    {m.email} · {MEMBER_ROLE_LABELS[m.role]} · {formatDate(m.joinedAt)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Text className="text-sm text-muted-foreground">
            Nadie ha aceptado todavía la invitación.
          </Text>
        )}
        {!isFetching && invitations.length ? (
          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground">Invitaciones abiertas</Text>
            {invitations.map((i) => (
              <EntityLabel
                key={i.id}
                entity={{ kind: "user", id: null, avatar: null }}
                name={`${i.email} · ${MEMBER_ROLE_LABELS[i.role]} · caduca el ${formatDate(i.expiresAt)}`}
                textClassName="text-sm text-muted-foreground"
              />
            ))}
          </View>
        ) : null}
      </View>

      <Card className="gap-4 p-5">
        <SectionTitle>Invitar a esta organización</SectionTitle>
        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email"
          />
        </Field>
        <Field label="Rol">
          <Select value={role} items={MEMBER_ROLE_LABELS} onValueChange={setRole} />
        </Field>
        <FormError message={inviteError} />
        <Button
          icon={MailPlus}
          loading={invite.isPending}
          disabled={!email.trim()}
          onPress={() => {
            setInviteError(null);
            invite.mutate();
          }}
        >
          Enviar invitación
        </Button>
      </Card>
    </Screen>
  );
}
