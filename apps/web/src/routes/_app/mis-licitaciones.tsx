import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bookmark, ListTodo, StickyNote } from "lucide-react";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/states";
import { TenderList } from "@/components/tenders/TenderList";
import { TrackButton } from "@/components/tenders/TrackButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WORKFLOW_LABELS, WORKFLOW_STATUSES } from "@licita/domain/tenders";
import { formatDateTime, pluralize } from "@/lib/format";
import { trackedListQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/mis-licitaciones")({
  validateSearch: z.object({ status: z.enum(WORKFLOW_STATUSES).optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(trackedListQuery(deps.status)),
  head: () => ({ meta: [{ title: "Mis licitaciones · Licita" }] }),
  component: MyTenders,
});

function MyTenders() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery(trackedListQuery(status));
  const all = useQuery(trackedListQuery());
  const counts = all.data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Mis licitaciones"
        description="Las licitaciones que tu empresa está siguiendo, con su estado interno, notas y tareas. Solo las ve tu empresa."
      />
      <Tabs
        value={status ?? "all"}
        onValueChange={(v) =>
          void navigate({
            search: { status: v === "all" ? undefined : (v as (typeof WORKFLOW_STATUSES)[number]) },
          })
        }
        className="mb-4"
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="all">Todas ({total})</TabsTrigger>
            {WORKFLOW_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {WORKFLOW_LABELS[s]}
                {counts[s] ? ` (${counts[s]})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={
            status ? `Nada en «${WORKFLOW_LABELS[status]}»` : "Aún no sigues ninguna licitación"
          }
          description="Pulsa «Guardar» en cualquier licitación para hacer seguimiento, añadir notas y tareas."
          action={
            <Button asChild>
              <Link to="/oportunidades">Ver oportunidades</Link>
            </Button>
          }
        />
      ) : (
        <TenderList
          rows={query.data.items.map((t) => ({
            id: t.tenderId,
            title: t.title,
            authorityName: t.authorityName,
            status: t.status,
            contractType: t.contractType,
            executionProvinces: t.executionProvinces,
            baseBudgetExVatEur: t.baseBudgetExVatEur,
            submissionDeadlineAt: t.submissionDeadlineAt,
            trackedStatus: t.workflowStatus,
            note:
              t.openTasks || t.notes ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {t.openTasks ? (
                    <span className="inline-flex items-center gap-1">
                      <ListTodo className="size-3" />
                      {pluralize(t.openTasks, "tarea pendiente", "tareas pendientes")}
                      {t.nextTaskDueAt ? ` · próxima ${formatDateTime(t.nextTaskDueAt)}` : ""}
                    </span>
                  ) : null}
                  {t.notes ? (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <StickyNote className="size-3 shrink-0" />
                      <span className="line-clamp-1">{t.notes}</span>
                    </span>
                  ) : null}
                </span>
              ) : undefined,
            actions: <TrackButton tenderId={t.tenderId} tracked />,
          }))}
        />
      )}
    </>
  );
}
