import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Loader2, Newspaper, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { ActionRow, type ActionSummary } from "@/components/felina/ActionRow";
import { Pager } from "@/components/felina/Pager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { actionsQuery } from "@/lib/queries";

const searchSchema = z.object({
  validation: z.enum(["pending", "validated", "all"]).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});

/** Town halls: every action in their municipality, newest first, to validate. */
export const Route = createFileRoute("/_app/feed")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.membership.organization.kind !== "town_hall") throw redirect({ to: "/acciones" });
  },
  head: () => ({ meta: [{ title: `Feed de acciones · ${APP_NAME}` }] }),
  component: Feed,
});

function ValidateButton({ action }: { action: ActionSummary }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (validated: boolean) => api().actions.setValidation(action.id, validated),
    onSuccess: async (_, validated) => {
      toast.success(validated ? "Acción validada" : "Validación retirada");
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return action.validatedAt && !action.modifiedAfterValidation ? (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => mutation.mutate(false)}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
      Dejar sin validar
    </Button>
  ) : (
    <Button size="sm" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
      {action.validatedAt ? "Validar de nuevo" : "Validar"}
    </Button>
  );
}

function Feed() {
  const { membership } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const validation = search.validation ?? "pending";
  const query = useQuery(
    actionsQuery({
      view: "feed",
      validation: validation === "all" ? undefined : validation,
      page: search.page ?? 1,
    }),
  );

  return (
    <>
      <PageHeader
        title="Feed de acciones"
        description={`Acciones de las asociaciones en ${membership.organization.municipalityName ?? "tu municipio"}. Valídalas o déjalas sin validar.`}
      />
      <Tabs
        value={validation}
        onValueChange={(v) =>
          navigate({ search: { validation: v as typeof validation, page: undefined } })
        }
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Sin validar</TabsTrigger>
          <TabsTrigger value="validated">Validadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.isPending || query.isFetching ? (
        <RowsSkeleton badges trailing label="Cargando acciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length ? (
        <>
          <ul className="surface divide-y">
            {query.data.items.map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                showOrganization
                trailing={<ValidateButton action={a} />}
                footer={`Registrada ${formatDateTime(a.createdAt)}${
                  a.description
                    ? ` · ${a.description.slice(0, 140)}${a.description.length > 140 ? "…" : ""}`
                    : ""
                }`}
              />
            ))}
          </ul>
          <Pager
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPage={(page) => void navigate({ search: (s) => ({ ...s, page }) })}
          />
        </>
      ) : (
        <EmptyState
          icon={Newspaper}
          title={
            validation === "pending" ? "No hay acciones pendientes de validar" : "No hay acciones"
          }
          description="Cuando una asociación registre una acción en tu municipio, aparecerá aquí."
        />
      )}
    </>
  );
}
