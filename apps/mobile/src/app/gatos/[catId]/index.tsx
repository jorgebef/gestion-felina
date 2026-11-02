import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { ClipboardList, Pencil, Plus } from "lucide-react-native";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import { catDisplayName } from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { formatAge, formatDate, formatDateTime } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { CardsSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import { ErrorState, Facts, LoadingState, PageHeader, SectionTitle } from "@/components/app/states";
import { ActionRow } from "@/components/felina/action-row";
import { EntityLabel } from "@/components/felina/entity-avatar";
import { sexLabel, SterilizedBadge } from "@/components/felina/badges";
import { CatPhoto } from "@/components/felina/cat-photo";
import { DeleteOrRequestButton, PendingDeletionNotice } from "@/components/felina/deletion";
import { LocationMap } from "@/components/felina/location-map";
import { ProposalList } from "@/components/felina/proposals";
import { ProposeChangeSheet } from "@/components/felina/propose-change-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { catQuery, proposalsQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

export default function CatDetail() {
  const { catId } = useLocalSearchParams<{ catId: string }>();
  const { isAdmin, isAssociation } = useMembership();
  const query = useQuery(catQuery(catId));
  const proposals = useQuery(proposalsQuery({ catId }));
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => api().cats.delete(catId),
    onSuccess: async () => {
      toast.success("Gato eliminado");
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
  const { cat, permissions } = query.data;
  const name = catDisplayName(cat);
  const target = { type: "cat" as const, id: cat.id, name };

  return (
    <Screen onRefresh={() => Promise.all([query.refetch(), proposals.refetch()])}>
      <Stack.Screen options={{ title: name }} />
      <CatPhoto
        catId={cat.id}
        version={cat.updatedAt}
        alt={`Foto de ${name}`}
        className="aspect-square w-full rounded-xl border border-border"
      />
      <PageHeader
        eyebrow={<SterilizedBadge sterilized={cat.sterilized} />}
        title={name}
        description={cat.colonyName ? `Colonia ${cat.colonyName}` : "Sin colonia"}
        actions={
          <>
            {permissions.canPropose ? (
              <ProposeChangeSheet target={{ type: "cat", id: cat.id, current: cat }} />
            ) : null}
            {permissions.canAddActions ? (
              <Link
                href={{
                  pathname: "/acciones/nueva",
                  params: { catId, colonyId: cat.colonyId ?? undefined },
                }}
                asChild
              >
                <Button variant="outline" icon={Plus}>
                  Acción
                </Button>
              </Link>
            ) : null}
            {permissions.canEdit ? (
              <Link href={`/gatos/${catId}/editar`} asChild>
                <Button variant="outline" icon={Pencil}>
                  Editar
                </Button>
              </Link>
            ) : null}
            <DeleteOrRequestButton
              target={target}
              permissions={permissions}
              pendingDeletion={query.data.pendingDeletion}
              consequences="Se borrarán su ficha y su foto, y dejará de aparecer en las acciones."
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

      <Card className="gap-4 p-5">
        <Facts
          items={[
            { label: "Sexo", value: sexLabel(cat.sex) },
            {
              label: "Fecha de nacimiento",
              value: cat.birthDate
                ? `${cat.birthDateApproximate ? "≈ " : ""}${formatDate(cat.birthDate)} (${formatAge(cat.birthDate, cat.birthDateApproximate)})`
                : "Desconocida",
            },
            {
              label: "Colonia",
              value: cat.colonyId ? (
                <Link href={`/colonias/${cat.colonyId}`} className="text-base text-brand">
                  {cat.colonyName}
                </Link>
              ) : (
                "Sin colonia"
              ),
            },
            {
              label: "Asociación",
              value: cat.organizationName ? (
                <EntityLabel
                  entity={{
                    kind: "association",
                    id: cat.organizationId,
                    avatar: cat.organizationAvatar,
                  }}
                  name={cat.organizationName}
                />
              ) : (
                "—"
              ),
            },
            { label: "Municipio", value: cat.municipalityName },
            { label: "Dirección", value: cat.address ?? "—" },
            {
              label: "Coordenadas",
              value: `${cat.latitude.toFixed(6)}, ${cat.longitude.toFixed(6)}`,
            },
            { label: "Actualizado", value: formatDateTime(cat.updatedAt) },
          ]}
        />
        {cat.description ? (
          <Text className="text-sm text-foreground">{cat.description}</Text>
        ) : null}
      </Card>

      <LocationMap
        label="Ubicación del gato"
        className="h-56"
        picked={{ latitude: cat.latitude, longitude: cat.longitude }}
      />

      <View className="gap-3">
        <SectionTitle icon={ClipboardList}>Historial de acciones</SectionTitle>
        {query.isFetching ? (
          <RowsSkeleton badges rows={3} label="Cargando acciones…" />
        ) : query.data.actions.length ? (
          <Card>
            {query.data.actions.map((a, i) => (
              <ActionRow key={a.id} action={a} first={i === 0} />
            ))}
          </Card>
        ) : (
          <Text className="text-sm text-muted-foreground">Sin acciones registradas.</Text>
        )}
      </View>

      {proposals.data?.length ? (
        <View className="gap-3">
          <SectionTitle>Propuestas de cambio</SectionTitle>
          {proposals.isFetching ? (
            <CardsSkeleton cards={1} label="Cargando propuestas…" />
          ) : (
            <ProposalList proposals={proposals.data} canResolve={isAdmin && isAssociation} />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
