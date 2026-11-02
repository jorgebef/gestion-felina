import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { ClipboardList, Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  type ActionStatus,
  type ActionType,
} from "@felina/domain/felina";

import { Screen } from "@/components/app/screen";
import { RowsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { ActionRow } from "@/components/felina/action-row";
import { Pager } from "@/components/felina/pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl, Select } from "@/components/ui/controls";
import { actionsQuery } from "@/lib/queries";

const WHEN = { upcoming: "Próximas", past: "Pasadas", all: "Todas" } as const;

/** Associations: their actions, filtered like the web app's /acciones. */
export function ActionsScreen() {
  const [when, setWhen] = useState<keyof typeof WHEN>("upcoming");
  const [type, setType] = useState<ActionType | "all">("all");
  const [status, setStatus] = useState<ActionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const query = useQuery(
    actionsQuery({
      when: when === "all" ? undefined : when,
      type: type === "all" ? undefined : type,
      status: status === "all" ? undefined : status,
      page,
    }),
  );
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/acciones/nueva" asChild>
              <Button variant="ghost" size="icon" icon={Plus} accessibilityLabel="Nueva acción" />
            </Link>
          ),
        }}
      />
      <SegmentedControl value={when} items={WHEN} onValueChange={filter(setWhen)} />
      <View className="flex-row gap-2">
        <Select
          className="flex-1"
          value={type}
          items={{ all: "Todos los tipos", ...ACTION_TYPE_LABELS }}
          onValueChange={filter(setType)}
        />
        <Select
          className="flex-1"
          value={status}
          items={{ all: "Todos los estados", ...ACTION_STATUS_LABELS }}
          onValueChange={filter(setStatus)}
        />
      </View>
      {query.isPending || query.isFetching ? (
        <RowsSkeleton badges label="Cargando acciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length ? (
        <>
          <Card>
            {query.data.items.map((a, i) => (
              <ActionRow key={a.id} action={a} first={i === 0} />
            ))}
          </Card>
          <Pager
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPage={setPage}
          />
        </>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={when === "upcoming" ? "No hay acciones programadas" : "No hay acciones"}
          action={
            <Link href="/acciones/nueva" asChild>
              <Button>Nueva acción</Button>
            </Link>
          }
        />
      )}
    </Screen>
  );
}
