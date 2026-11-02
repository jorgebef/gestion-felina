import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Cat, ClipboardList, Pencil, Plus, Undo2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import { errorMessage } from "@felina/client/errors";
import { formatDate, formatDateTime } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { CardsSkeleton, CatCardsSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import {
  EmptyState,
  ErrorState,
  Facts,
  LoadingState,
  PageHeader,
  SectionTitle,
} from "@/components/app/states";
import { ActionRow } from "@/components/felina/action-row";
import { EntityLabel } from "@/components/felina/entity-avatar";
import { AuthorizationBadge } from "@/components/felina/badges";
import { CatGrid } from "@/components/felina/cat-card";
import { ColonyManagers } from "@/components/felina/colony-managers";
import { DeleteOrRequestButton, PendingDeletionNotice } from "@/components/felina/deletion";
import { LocationMap } from "@/components/felina/location-map";
import { ProposalList } from "@/components/felina/proposals";
import { ProposeChangeSheet } from "@/components/felina/propose-change-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { colonyQuery, proposalsQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

export default function ColonyDetail() {
  const { colonyId } = useLocalSearchParams<{ colonyId: string }>();
  const { isAdmin, isAssociation, organization } = useMembership();
  const query = useQuery(colonyQuery(colonyId));
  const proposals = useQuery(proposalsQuery({ colonyId }));
  const queryClient = useQueryClient();

  const authorize = useMutation({
    mutationFn: (authorized: boolean) => api().colonies.setAuthorization(colonyId, authorized),
    onSuccess: async (_, authorized) => {
      toast.success(authorized ? "Colonia validada" : "Validación retirada");
      await queryClient.invalidateQueries({ queryKey: ["colonies"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api().colonies.delete(colonyId),
    onSuccess: async () => {
      toast.success("Colonia eliminada");
      router.back();
      await queryClient.invalidateQueries();
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
  const { colony, permissions } = query.data;
  const isFetching = query.isFetching;
  const target = { type: "colony" as const, id: colony.id, name: colony.name };

  return (
    <Screen onRefresh={() => Promise.all([query.refetch(), proposals.refetch()])}>
      <Stack.Screen options={{ title: colony.name }} />
      <PageHeader
        eyebrow={<AuthorizationBadge authorizedAt={colony.authorizedAt} />}
        title={colony.name}
        description={[colony.address, colony.municipalityName].filter(Boolean).join(" · ")}
        actions={
          <>
            {permissions.canAuthorize ? (
              colony.authorizedAt ? (
                <Button
                  variant="outline"
                  icon={Undo2}
                  loading={authorize.isPending}
                  onPress={() => authorize.mutate(false)}
                >
                  Retirar validación
                </Button>
              ) : (
                <Button
                  icon={BadgeCheck}
                  loading={authorize.isPending}
                  onPress={() => authorize.mutate(true)}
                >
                  Validar colonia
                </Button>
              )
            ) : null}
            {permissions.canPropose ? (
              <ProposeChangeSheet target={{ type: "colony", id: colony.id, current: colony }} />
            ) : null}
            {permissions.canEdit ? (
              <Link href={`/colonias/${colonyId}/editar`} asChild>
                <Button variant="outline" icon={Pencil}>
                  Editar
                </Button>
              </Link>
            ) : null}
            <DeleteOrRequestButton
              target={target}
              permissions={permissions}
              pendingDeletion={query.data.pendingDeletion}
              consequences="Sus gatos seguirán en la asociación, sin colonia, y las acciones conservan su historial."
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

      <LocationMap
        label="Ubicación de la colonia"
        className="h-56"
        picked={{ latitude: colony.latitude, longitude: colony.longitude }}
      />

      <Card className="gap-4 p-5">
        <Facts
          items={[
            {
              label: "Asociación gestora",
              value: colony.organizationName ? (
                <EntityLabel
                  entity={{
                    kind: "association",
                    id: colony.organizationId,
                    avatar: colony.organizationAvatar,
                  }}
                  name={colony.organizationName}
                />
              ) : (
                "—"
              ),
            },
            { label: "Municipio", value: colony.municipalityName },
            { label: "Dirección", value: colony.address ?? "—" },
            {
              label: "Coordenadas",
              value: `${colony.latitude.toFixed(6)}, ${colony.longitude.toFixed(6)}`,
            },
            {
              label: "Validación del ayuntamiento",
              value: colony.authorizedAt
                ? `Validada el ${formatDate(colony.authorizedAt)}`
                : "Sin validar",
            },
            { label: "Actualizada", value: formatDateTime(colony.updatedAt) },
          ]}
        />
        {colony.description ? (
          <Text className="text-sm text-foreground">{colony.description}</Text>
        ) : null}
      </Card>

      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <SectionTitle icon={Cat}>
            {isFetching ? "Gatos" : `Gatos (${query.data.cats.length})`}
          </SectionTitle>
          {permissions.canAddCats ? (
            <Link href={{ pathname: "/gatos/nuevo", params: { colonyId } }} asChild>
              <Button size="sm" variant="outline" icon={Plus}>
                Añadir gato
              </Button>
            </Link>
          ) : null}
        </View>
        {isFetching ? (
          <CatCardsSkeleton cards={4} />
        ) : query.data.cats.length ? (
          <CatGrid cats={query.data.cats} />
        ) : (
          <EmptyState icon={Cat} title="Sin gatos registrados en esta colonia" />
        )}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <SectionTitle icon={ClipboardList}>Acciones</SectionTitle>
          {permissions.canAddActions ? (
            <Link href={{ pathname: "/acciones/nueva", params: { colonyId } }} asChild>
              <Button size="sm" variant="outline" icon={Plus}>
                Nueva acción
              </Button>
            </Link>
          ) : null}
        </View>
        {isFetching ? (
          <RowsSkeleton badges rows={3} label="Cargando acciones…" />
        ) : query.data.actions.length ? (
          <Card>
            {query.data.actions.map((a, i) => (
              <ActionRow key={a.id} action={a} first={i === 0} />
            ))}
          </Card>
        ) : (
          <Text className="text-sm text-muted-foreground">Sin acciones todavía.</Text>
        )}
      </View>

      {organization.id === colony.organizationId ? (
        <ColonyManagers
          colonyId={colonyId}
          managers={query.data.managers}
          canManageManagers={permissions.canManageManagers}
          loading={isFetching}
        />
      ) : null}

      <View className="gap-3">
        <SectionTitle>Propuestas de cambio</SectionTitle>
        {proposals.isPending || proposals.isFetching ? (
          <CardsSkeleton cards={1} label="Cargando propuestas…" />
        ) : proposals.data?.length ? (
          <ProposalList proposals={proposals.data} canResolve={isAdmin && isAssociation} />
        ) : (
          <Text className="text-sm text-muted-foreground">
            {permissions.canPropose
              ? "Si algún dato no es correcto, propón el cambio a la asociación gestora."
              : "El ayuntamiento no ha propuesto cambios."}
          </Text>
        )}
      </View>
    </Screen>
  );
}
