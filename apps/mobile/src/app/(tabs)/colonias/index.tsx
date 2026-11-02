import { useQuery } from "@tanstack/react-query";
import { Link, router, Stack } from "expo-router";
import { Cat, MapPinned, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDate, pluralize } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { CardsSkeleton, MapSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { searchBarOptions } from "@/components/app/tab-stack";
import { AuthorizationBadge } from "@/components/felina/badges";
import { LocationMap } from "@/components/felina/location-map";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl, Select } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { coloniesQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";
import { useDebounced } from "@/lib/use-debounced";

const AUTHORIZATION = { all: "Todas", yes: "Autorizadas", no: "Sin autorizar" } as const;
const VIEWS = { list: "Lista", map: "Mapa" } as const;

export default function Colonies() {
  const { organization, isTownHall, isAdmin } = useMembership();
  const [term, setTerm] = useState("");
  const [authorized, setAuthorized] = useState<keyof typeof AUTHORIZATION>("all");
  const [view, setView] = useState<keyof typeof VIEWS>("list");
  const q = useDebounced(term.trim()) || undefined;
  const query = useQuery(
    coloniesQuery({ q, authorized: authorized === "all" ? undefined : authorized }),
  );
  const canCreate = !isTownHall && isAdmin;

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: searchBarOptions("Buscar por nombre o dirección", setTerm),
          headerRight: canCreate
            ? () => (
                <Link href="/colonias/nueva" asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={Plus}
                    accessibilityLabel="Nueva colonia"
                  />
                </Link>
              )
            : undefined,
        }}
      />
      <Text className="text-sm text-muted-foreground">
        {isTownHall
          ? `Colonias registradas en ${organization.municipalityName ?? "tu municipio"} por las asociaciones.`
          : "Las colonias que gestiona tu asociación."}
      </Text>
      <View className="flex-row items-center gap-2">
        <Select
          className="flex-1"
          value={authorized}
          items={AUTHORIZATION}
          onValueChange={setAuthorized}
        />
        <SegmentedControl className="w-40" value={view} items={VIEWS} onValueChange={setView} />
      </View>

      {query.isPending || query.isFetching ? (
        view === "map" ? (
          <MapSkeleton className="h-[480px]" />
        ) : (
          <CardsSkeleton label="Cargando colonias…" />
        )
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={MapPinned}
          title={
            q || authorized !== "all" ? "No hay colonias con estos filtros" : "Aún no hay colonias"
          }
          description={
            isTownHall
              ? "Cuando una asociación registre una colonia en tu municipio, aparecerá aquí."
              : canCreate
                ? "Registra la primera colonia con su ubicación exacta."
                : "Los administradores de la asociación registran las colonias."
          }
          action={
            canCreate ? (
              <Link href="/colonias/nueva" asChild>
                <Button>Registrar colonia</Button>
              </Link>
            ) : undefined
          }
        />
      ) : view === "map" ? (
        <LocationMap
          label="Mapa de colonias"
          className="h-[480px]"
          markers={query.data.map((c) => ({
            id: c.id,
            latitude: c.latitude,
            longitude: c.longitude,
            label: c.name,
            description: pluralize(c.catCount, "gato", "gatos"),
            tone: c.authorizedAt ? "positive" : "brand",
            count: c.catCount,
          }))}
          onMarkerPress={(id) => router.push(`/colonias/${id}`)}
        />
      ) : (
        <View className="gap-3">
          {query.data.map((c) => (
            <Link key={c.id} href={`/colonias/${c.id}`} asChild>
              <Pressable accessibilityRole="link" className="active:opacity-80">
                <Card className="gap-1 p-4">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 text-base font-medium text-foreground">{c.name}</Text>
                    <AuthorizationBadge authorizedAt={c.authorizedAt} />
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {[c.address, c.municipalityName].filter(Boolean).join(" · ")}
                  </Text>
                  {isTownHall && c.organizationName ? (
                    <Text className="text-sm text-muted-foreground">
                      Gestiona: {c.organizationName}
                    </Text>
                  ) : null}
                  <View className="mt-2 flex-row flex-wrap items-center gap-2">
                    <Icon icon={Cat} color="muted-foreground" size={13} />
                    <Text className="text-xs text-muted-foreground">
                      {pluralize(c.catCount, "gato", "gatos")}
                      {c.lastActionAt ? ` · Última acción ${formatDate(c.lastActionAt)}` : ""}
                    </Text>
                    {c.pendingProposals ? (
                      <Pill tone="warning">
                        {pluralize(c.pendingProposals, "propuesta", "propuestas")}
                      </Pill>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>
      )}
    </Screen>
  );
}
