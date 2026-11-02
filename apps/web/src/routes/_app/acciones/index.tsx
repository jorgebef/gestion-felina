import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Plus } from "lucide-react";
import { z } from "zod";

import {
  ACTION_STATUSES,
  ACTION_STATUS_LABELS,
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
} from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { ActionRow } from "@/components/felina/ActionRow";
import { Pager } from "@/components/felina/Pager";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { actionsQuery } from "@/lib/queries";

const searchSchema = z.object({
  when: z.enum(["upcoming", "past", "all"]).optional().catch(undefined),
  type: z.enum(ACTION_TYPES).optional().catch(undefined),
  status: z.enum(ACTION_STATUSES).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/acciones/")({
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    // Town halls follow actions in their feed.
    if (context.membership.organization.kind === "town_hall") throw redirect({ to: "/feed" });
  },
  head: () => ({ meta: [{ title: `Acciones · ${APP_NAME}` }] }),
  component: Actions,
});

function Actions() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const when = search.when ?? "upcoming";
  const query = useQuery(
    actionsQuery({
      when: when === "all" ? undefined : when,
      type: search.type,
      status: search.status,
      page: search.page ?? 1,
    }),
  );

  return (
    <>
      <PageHeader
        title="Acciones"
        description="Castraciones, visitas al veterinario, capturas, sueltas y alimentación."
        actions={
          <Link to="/acciones/nueva" className={buttonVariants()}>
            <Plus /> Nueva acción
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={when}
          onValueChange={(v) =>
            navigate({ search: (s) => ({ ...s, when: v as typeof when, page: undefined }) })
          }
        >
          <TabsList>
            <TabsTrigger value="upcoming">Próximas</TabsTrigger>
            <TabsTrigger value="past">Pasadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Select
            items={{ all: "Todos los tipos", ...ACTION_TYPE_LABELS }}
            value={search.type ?? "all"}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  type: v === "all" ? undefined : (v as (typeof ACTION_TYPES)[number]),
                  page: undefined,
                }),
              })
            }
          >
            <SelectTrigger className="w-full bg-card sm:w-44" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {ACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ACTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={{ all: "Todos los estados", ...ACTION_STATUS_LABELS }}
            value={search.status ?? "all"}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  status: v === "all" ? undefined : (v as (typeof ACTION_STATUSES)[number]),
                  page: undefined,
                }),
              })
            }
          >
            <SelectTrigger className="w-full bg-card sm:w-44" aria-label="Estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {ACTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ACTION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {query.isPending || query.isFetching ? (
        <RowsSkeleton badges label="Cargando acciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length ? (
        <>
          <ul className="surface divide-y">
            {query.data.items.map((a) => (
              <ActionRow key={a.id} action={a} />
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
          icon={ClipboardList}
          title={when === "upcoming" ? "No hay acciones programadas" : "No hay acciones"}
          action={
            <Link to="/acciones/nueva" className={buttonVariants()}>
              Nueva acción
            </Link>
          }
        />
      )}
    </>
  );
}
