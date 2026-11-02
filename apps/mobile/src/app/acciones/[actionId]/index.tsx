import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Cat, Pencil, Undo2, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { toast } from "sonner-native";

import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  catDisplayName,
  type ActionStatus,
} from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { formatDate, formatDateTime, formatRelativeDays } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { CatCardsSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import { ErrorState, Facts, LoadingState, PageHeader, SectionTitle } from "@/components/app/states";
import {
  ActionStatusBadge,
  ActionTypeBadge,
  UrgentBadge,
  ValidationBadge,
} from "@/components/felina/badges";
import { DeleteOrRequestButton, PendingDeletionNotice } from "@/components/felina/deletion";
import { EntityAvatar, EntityLabel } from "@/components/felina/entity-avatar";
import { CatPhoto } from "@/components/felina/cat-photo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { actionQuery } from "@/lib/queries";

export default function ActionDetail() {
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const query = useQuery(actionQuery(actionId));
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();

  const setStatus = useMutation({
    mutationFn: (status: ActionStatus) => api().actions.setStatus(actionId, status),
    onSuccess: async ({ sterilizedCats }) => {
      toast.success("Estado actualizado", {
        description: sterilizedCats
          ? sterilizedCats === 1
            ? "1 gato marcado como castrado."
            : `${sterilizedCats} gatos marcados como castrados.`
          : undefined,
      });
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const validate = useMutation({
    mutationFn: (validated: boolean) => api().actions.setValidation(actionId, validated),
    onSuccess: async (_, validated) => {
      toast.success(validated ? "Acción validada" : "Validación retirada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api().actions.delete(actionId),
    onSuccess: async () => {
      toast.success("Acción eliminada");
      router.back();
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { action, permissions } = query.data;
  const target = { type: "action" as const, id: action.id, name: action.name };
  const isFetching = query.isFetching;

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: action.name }} />
      <PageHeader
        eyebrow={ACTION_TYPE_LABELS[action.actionType]}
        title={action.name}
        description={`${formatDateTime(action.scheduledAt)} · ${formatRelativeDays(action.scheduledAt)}`}
        actions={
          <>
            {permissions.canValidate ? (
              action.validatedAt ? (
                <Button
                  variant="outline"
                  icon={Undo2}
                  loading={validate.isPending}
                  onPress={() => validate.mutate(false)}
                >
                  Dejar sin validar
                </Button>
              ) : (
                <Button
                  icon={BadgeCheck}
                  loading={validate.isPending}
                  onPress={() => validate.mutate(true)}
                >
                  Validar acción
                </Button>
              )
            ) : null}
            {permissions.canEdit ? (
              <Link href={`/acciones/${actionId}/editar`} asChild>
                <Button variant="outline" icon={Pencil}>
                  Editar
                </Button>
              </Link>
            ) : null}
            <DeleteOrRequestButton
              target={target}
              permissions={permissions}
              pendingDeletion={query.data.pendingDeletion}
              consequences="Desaparecerá del historial de los gatos y del feed del ayuntamiento. Si ya se realizó, es mejor marcarla como cancelada o realizada."
              onDelete={() => remove.mutate()}
              deleting={remove.isPending}
            />
          </>
        }
      />

      <PendingDeletionNotice
        target={target}
        pending={query.data.pendingDeletion}
        canResolve={permissions.canResolveDeletion}
        onApproved={() => router.back()}
      />

      <View className="flex-row flex-wrap gap-1.5">
        {action.isUrgent ? <UrgentBadge /> : null}
        <ActionTypeBadge type={action.actionType} />
        <ActionStatusBadge status={action.status} />
        <ValidationBadge
          validatedAt={action.validatedAt}
          modifiedAfterValidation={action.modifiedAfterValidation}
        />
      </View>

      {permissions.canEdit ? (
        <Field label="Estado">
          <Select
            value={action.status}
            items={ACTION_STATUS_LABELS}
            disabled={setStatus.isPending}
            onValueChange={(v) => setStatus.mutate(v)}
          />
        </Field>
      ) : null}

      <Card className="gap-4 p-5">
        <Facts
          items={[
            {
              label: "Asociación",
              value: action.organizationName ? (
                <EntityLabel
                  entity={{
                    kind: "association",
                    id: action.organizationId,
                    avatar: action.organizationAvatar,
                  }}
                  name={action.organizationName}
                />
              ) : (
                "—"
              ),
            },
            {
              label: "Colonia",
              value: action.colonyId ? (
                <Link href={`/colonias/${action.colonyId}`} className="text-base text-brand">
                  {action.colonyName}
                </Link>
              ) : (
                "Sin colonia"
              ),
            },
            { label: "Municipio", value: action.municipalityName },
            { label: "Fecha y hora", value: formatDateTime(action.scheduledAt) },
            {
              label: "Validación del ayuntamiento",
              value: action.validatedAt
                ? `Validada el ${formatDate(action.validatedAt)}${action.modifiedAfterValidation ? " (modificada después)" : ""}`
                : "Sin validar",
            },
            { label: "Última modificación", value: formatDateTime(action.updatedAt) },
          ]}
        />
        {action.description ? (
          <Text className="text-sm text-foreground">{action.description}</Text>
        ) : null}
      </Card>

      <View className="gap-3">
        <SectionTitle icon={Cat}>
          {isFetching ? "Gatos" : `Gatos (${query.data.cats.length})`}
        </SectionTitle>
        {isFetching ? (
          <CatCardsSkeleton cards={2} />
        ) : query.data.cats.length ? (
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {query.data.cats.map((cat) => (
              <Link key={cat.id} href={`/gatos/${cat.id}`} asChild>
                <Pressable accessibilityRole="link" className="w-[48.5%] active:opacity-80">
                  <Card>
                    <CatPhoto
                      catId={cat.id}
                      version={cat.updatedAt}
                      alt={catDisplayName(cat)}
                      className="aspect-square w-full"
                    />
                    <Text numberOfLines={1} className="p-2 text-sm font-medium text-foreground">
                      {catDisplayName(cat)}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted-foreground">
            No hay gatos asociados a esta acción.
          </Text>
        )}
      </View>

      <Card className="gap-3 p-5">
        <SectionTitle icon={Users}>
          {isFetching ? "Participantes" : `Participantes (${query.data.participantCount})`}
        </SectionTitle>
        {isFetching ? (
          <RowsSkeleton framed={false} rows={2} label="Cargando participantes…" />
        ) : query.data.participants.length ? (
          <View className="gap-2">
            {query.data.participants.map((p) => (
              <View key={p.userId} className="flex-row items-center gap-3">
                <EntityAvatar
                  entity={{ kind: "user", id: p.userId, avatar: p.avatar }}
                  name={p.name || p.email || "Participante"}
                />
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-base font-medium text-foreground">
                    {p.name || p.email}
                  </Text>
                  {p.name ? (
                    <Text numberOfLines={1} className="text-xs text-muted-foreground">
                      {p.email}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-muted-foreground">
            Las personas participantes solo son visibles para su asociación.
          </Text>
        )}
      </Card>
    </Screen>
  );
}
