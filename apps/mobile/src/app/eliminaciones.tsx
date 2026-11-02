import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/app/screen";
import { CardsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { DeletionRequestCard } from "@/components/felina/deletion";
import { SegmentedControl } from "@/components/ui/controls";
import { deletionRequestsQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

const STATUS = {
  pending: "Pendientes",
  approved: "Aprobadas",
  rejected: "Rechazadas",
  all: "Todas",
} as const;

/** Deletions of colonies, cats and actions that only an association admin can approve. */
export default function Deletions() {
  const { isAdmin } = useMembership();
  const [status, setStatus] = useState<keyof typeof STATUS>("pending");
  const query = useQuery(deletionRequestsQuery({ status: status === "all" ? undefined : status }));

  return (
    <Screen onRefresh={query.refetch}>
      <Text className="text-sm text-muted-foreground">
        {isAdmin
          ? "Colonias, gatos y acciones que el equipo pide eliminar. No se eliminan hasta que las apruebes."
          : "Solo los administradores eliminan colonias, gatos y acciones; aquí ves lo que se ha pedido eliminar."}
      </Text>
      <SegmentedControl value={status} items={STATUS} onValueChange={setStatus} />
      {query.isPending || query.isFetching ? (
        <CardsSkeleton cards={3} label="Cargando solicitudes…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length ? (
        <View className="gap-3">
          {query.data.map((r) => (
            <DeletionRequestCard key={r.id} request={r} canResolve={isAdmin} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={Trash2}
          title="No hay solicitudes"
          description="Cuando alguien pida eliminar una colonia, un gato o una acción, aparecerá aquí."
        />
      )}
    </Screen>
  );
}
