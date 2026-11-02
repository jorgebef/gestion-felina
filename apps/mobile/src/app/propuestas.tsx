import { useQuery } from "@tanstack/react-query";
import { GitPullRequestArrow } from "lucide-react-native";
import { useState } from "react";
import { Text } from "react-native";

import { Screen } from "@/components/app/screen";
import { CardsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { ProposalList } from "@/components/felina/proposals";
import { SegmentedControl } from "@/components/ui/controls";
import { proposalsQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

const STATUS = {
  pending: "Pendientes",
  accepted: "Aceptadas",
  rejected: "Rechazadas",
  all: "Todas",
} as const;

export default function Proposals() {
  const { isTownHall, isAdmin } = useMembership();
  const [status, setStatus] = useState<keyof typeof STATUS>("pending");
  const query = useQuery(proposalsQuery({ status: status === "all" ? undefined : status }));

  return (
    <Screen onRefresh={query.refetch}>
      <Text className="text-sm text-muted-foreground">
        {isTownHall
          ? "Cambios que has propuesto a las asociaciones sobre colonias y gatos de tu municipio."
          : "Cambios que propone el ayuntamiento. Solo se aplican si un administrador los acepta."}
      </Text>
      <SegmentedControl value={status} items={STATUS} onValueChange={setStatus} />
      {query.isPending || query.isFetching ? (
        <CardsSkeleton cards={3} label="Cargando propuestas…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length ? (
        <ProposalList proposals={query.data} canResolve={!isTownHall && isAdmin} />
      ) : (
        <EmptyState
          icon={GitPullRequestArrow}
          title="No hay propuestas"
          description={
            isTownHall
              ? "Desde la ficha de una colonia o un gato puedes proponer cambios."
              : "Cuando el ayuntamiento proponga un cambio, aparecerá aquí."
          }
        />
      )}
    </Screen>
  );
}
