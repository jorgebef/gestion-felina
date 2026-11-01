import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GitPullRequestArrow } from "lucide-react";
import { z } from "zod";

import { PROPOSAL_STATUSES } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/states";
import { ProposalList } from "@/components/felina/Proposals";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { proposalsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/propuestas")({
  validateSearch: z.object({
    status: z
      .enum([...PROPOSAL_STATUSES, "all"])
      .optional()
      .catch(undefined),
  }),
  head: () => ({ meta: [{ title: `Propuestas · ${APP_NAME}` }] }),
  component: Proposals,
});

function Proposals() {
  const { membership } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const status = search.status ?? "pending";
  const query = useQuery(proposalsQuery({ status: status === "all" ? undefined : status }));
  const townHall = membership.organization.kind === "town_hall";

  return (
    <>
      <PageHeader
        title="Propuestas de cambio"
        description={
          townHall
            ? "Cambios que has propuesto a las asociaciones sobre colonias y gatos de tu municipio."
            : "Cambios que propone el ayuntamiento. Solo se aplican si un administrador los acepta."
        }
      />
      <Tabs
        value={status}
        onValueChange={(v) => void navigate({ search: { status: v as typeof status } })}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="accepted">Aceptadas</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length ? (
        <div className="max-w-3xl">
          <ProposalList
            proposals={query.data}
            canResolve={!townHall && membership.role === "admin"}
          />
        </div>
      ) : (
        <EmptyState
          icon={GitPullRequestArrow}
          title="No hay propuestas"
          description={
            townHall
              ? "Desde la ficha de una colonia o un gato puedes proponer cambios."
              : "Cuando el ayuntamiento proponga un cambio, aparecerá aquí."
          }
        />
      )}
    </>
  );
}
