import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { Cat, Plus } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { CAT_SEX_LABELS, type CatSex } from "@felina/domain/felina";
import { colonyLabels, pluralize } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { CatCardsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { searchBarOptions } from "@/components/app/tab-stack";
import { CatGrid } from "@/components/felina/cat-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/controls";
import { catsQuery, coloniesQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";
import { useDebounced } from "@/lib/use-debounced";

export default function Cats() {
  const { isTownHall } = useMembership();
  const [term, setTerm] = useState("");
  const [colony, setColony] = useState("all");
  const [sex, setSex] = useState<CatSex | "all">("all");
  const q = useDebounced(term.trim()) || undefined;
  const query = useQuery(
    catsQuery({
      q,
      colonyId: colony === "all" || colony === "none" ? undefined : colony,
      colony: colony === "none" ? "none" : undefined,
      sex: sex === "all" ? undefined : sex,
    }),
  );
  const colonies = useQuery(coloniesQuery());

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: searchBarOptions("Buscar por nombre o descripción", setTerm),
          headerRight: !isTownHall
            ? () => (
                <Link href="/gatos/nuevo" asChild>
                  <Button variant="ghost" size="icon" icon={Plus} accessibilityLabel="Nuevo gato" />
                </Link>
              )
            : undefined,
        }}
      />
      <Text className="text-sm text-muted-foreground">
        {isTownHall
          ? "Gatos registrados en tu municipio."
          : query.data && !query.isFetching
            ? pluralize(query.data.length, "gato registrado", "gatos registrados")
            : " "}
      </Text>
      <View className="flex-row gap-2">
        <Select
          className="flex-1"
          value={colony}
          items={{ all: "Todas las colonias", none: "Sin colonia", ...colonyLabels(colonies.data) }}
          onValueChange={setColony}
        />
        <Select
          className="flex-1"
          value={sex}
          items={{ all: "Ambos sexos", ...CAT_SEX_LABELS }}
          onValueChange={setSex}
        />
      </View>
      {query.isPending || query.isFetching ? (
        <CatCardsSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length ? (
        <CatGrid cats={query.data} />
      ) : (
        <EmptyState
          icon={Cat}
          title="No hay gatos con estos filtros"
          action={
            !isTownHall ? (
              <Link href="/gatos/nuevo" asChild>
                <Button>Registrar un gato</Button>
              </Link>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}
