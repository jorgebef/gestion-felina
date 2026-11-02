import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { Building2, Landmark, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  ORGANIZATION_KIND_LABELS,
  ORGANIZATION_STATUS_LABELS,
  type OrganizationKind,
  type OrganizationStatus,
} from "@felina/domain/felina";
import { formatDate, pluralize } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { RowsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { searchBarOptions } from "@/components/app/tab-stack";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { NewTownHallSheet } from "@/components/felina/new-town-hall-sheet";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { adminOrganizationsQuery } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

export default function AdminHome() {
  const [status, setStatus] = useState<OrganizationStatus | "all">("pending");
  const [kind, setKind] = useState<OrganizationKind | "all">("all");
  const [term, setTerm] = useState("");
  const q = useDebounced(term.trim()) || undefined;
  const query = useQuery(
    adminOrganizationsQuery({
      status: status === "all" ? undefined : status,
      kind: kind === "all" ? undefined : kind,
      q,
    }),
  );

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: searchBarOptions("Nombre o municipio", setTerm),
          headerRight: () => (
            <Link href="/perfil" asChild>
              <Button variant="ghost" size="icon" icon={UserRound} accessibilityLabel="Mi perfil" />
            </Link>
          ),
        }}
      />
      <Text className="text-sm text-muted-foreground">
        Aprueba las asociaciones que se registran y da de alta los ayuntamientos.
      </Text>
      <NewTownHallSheet />
      <View className="flex-row gap-2">
        <Select
          className="flex-1"
          value={status}
          items={{ ...ORGANIZATION_STATUS_LABELS, all: "Todas" }}
          onValueChange={setStatus}
        />
        <Select
          className="flex-1"
          value={kind}
          items={{ all: "Todos los tipos", ...ORGANIZATION_KIND_LABELS }}
          onValueChange={setKind}
        />
      </View>
      {query.isPending || query.isFetching ? (
        <RowsSkeleton rows={6} label="Cargando organizaciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length ? (
        <Card>
          {query.data.items.map((o, i) => (
            <Link key={o.id} href={`/admin/${o.id}`} asChild>
              <Pressable
                accessibilityRole="link"
                className={cn(
                  "flex-row items-start gap-3 px-4 py-3 active:bg-muted",
                  i > 0 && "border-t border-border",
                )}
              >
                <View className="pt-0.5">
                  <Icon
                    icon={o.kind === "town_hall" ? Landmark : Building2}
                    color="muted-foreground"
                    size={20}
                  />
                </View>
                <View className="flex-1 gap-1">
                  <Text numberOfLines={1} className="text-base font-medium text-foreground">
                    {o.name}
                  </Text>
                  <Text numberOfLines={2} className="text-xs text-muted-foreground">
                    {ORGANIZATION_KIND_LABELS[o.kind]}
                    {o.municipalityName ? ` · ${o.municipalityName}` : ""} · alta{" "}
                    {formatDate(o.createdAt)}
                    {o.contactEmail ? ` · ${o.contactEmail}` : ""}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <OrganizationStatusBadge status={o.status} />
                    <Text className="text-xs text-muted-foreground">
                      {pluralize(o.members, "miembro", "miembros")}
                    </Text>
                    {o.openInvitations ? (
                      <Pill tone="brand">
                        {pluralize(o.openInvitations, "invitación", "invitaciones")}
                      </Pill>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState
          icon={Building2}
          title={status === "pending" ? "No hay solicitudes pendientes" : "No hay organizaciones"}
        />
      )}
    </Screen>
  );
}
