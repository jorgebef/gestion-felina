import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Cat, List, Map as MapIcon, MapPinned, Plus, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { CardsSkeleton, MapSkeleton } from "@/components/app/skeletons";
import { AuthorizationBadge, Pill } from "@/components/felina/badges";
import { LocationMap } from "@/components/felina/LocationMap";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, pluralize } from "@/lib/format";
import { coloniesQuery } from "@/lib/queries";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  authorized: z.enum(["yes", "no"]).optional().catch(undefined),
  view: z.enum(["list", "map"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/colonias/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: `Colonias · ${APP_NAME}` }] }),
  component: Colonies,
});

function Colonies() {
  const { membership } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState(search.q ?? "");
  const query = useQuery(coloniesQuery({ q: search.q, authorized: search.authorized }));
  const townHall = membership.organization.kind === "town_hall";
  const canCreate = !townHall && membership.role === "admin";
  const view = search.view ?? "list";

  return (
    <>
      <PageHeader
        title="Colonias"
        description={
          townHall
            ? `Colonias registradas en ${membership.organization.municipalityName ?? "tu municipio"} por las asociaciones.`
            : "Las colonias que gestiona tu asociación."
        }
        actions={
          canCreate ? (
            <Link to="/colonias/nueva" className={buttonVariants()}>
              <Plus /> Nueva colonia
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ search: (s) => ({ ...s, q: term.trim() || undefined }) });
          }}
        >
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o dirección"
            aria-label="Buscar colonias"
            className="bg-card pl-9"
          />
        </form>
        <Select
          items={{ all: "Todas", yes: "Autorizadas", no: "Sin autorizar" }}
          value={search.authorized ?? "all"}
          onValueChange={(v) =>
            void navigate({
              search: (s) => ({ ...s, authorized: v === "all" ? undefined : (v as "yes" | "no") }),
            })
          }
        >
          <SelectTrigger className="w-full bg-card sm:w-48" aria-label="Autorización">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="yes">Autorizadas</SelectItem>
            <SelectItem value="no">Sin autorizar</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Vista">
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            onClick={() => void navigate({ search: (s) => ({ ...s, view: undefined }) })}
          >
            <List /> Lista
          </Button>
          <Button
            size="sm"
            variant={view === "map" ? "secondary" : "ghost"}
            onClick={() => void navigate({ search: (s) => ({ ...s, view: "map" }) })}
          >
            <MapIcon /> Mapa
          </Button>
        </div>
      </div>

      {query.isPending || query.isFetching ? (
        view === "map" ? (
          <MapSkeleton className="h-[60vh]" />
        ) : (
          <CardsSkeleton label="Cargando colonias…" />
        )
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={MapPinned}
          title={
            search.q || search.authorized
              ? "No hay colonias con estos filtros"
              : "Aún no hay colonias"
          }
          description={
            townHall
              ? "Cuando una asociación registre una colonia en tu municipio, aparecerá aquí."
              : canCreate
                ? "Registra la primera colonia con su ubicación exacta."
                : "Los administradores de la asociación registran las colonias."
          }
          action={
            canCreate ? (
              <Link to="/colonias/nueva" className={buttonVariants()}>
                Registrar colonia
              </Link>
            ) : undefined
          }
        />
      ) : view === "map" ? (
        <LocationMap
          label="Mapa de colonias"
          className="h-[60vh]"
          markers={query.data.map((c) => ({
            id: c.id,
            latitude: c.latitude,
            longitude: c.longitude,
            label: `${c.name} · ${pluralize(c.catCount, "gato", "gatos")}`,
            tone: c.authorizedAt ? "positive" : "brand",
            count: c.catCount,
          }))}
          onMarkerClick={(colonyId) =>
            void navigate({ to: "/colonias/$colonyId", params: { colonyId } })
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {query.data.map((c) => (
            <li key={c.id}>
              <Link
                to="/colonias/$colonyId"
                params={{ colonyId: c.id }}
                className="surface block h-full p-4 transition-colors hover:border-brand/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{c.name}</p>
                  <AuthorizationBadge authorizedAt={c.authorizedAt} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[c.address, c.municipalityName].filter(Boolean).join(" · ")}
                </p>
                {townHall && c.organizationName ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Gestiona: {c.organizationName}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Cat className="size-3.5" /> {pluralize(c.catCount, "gato", "gatos")}
                  </span>
                  {c.lastActionAt ? (
                    <span>· Última acción {formatDate(c.lastActionAt)}</span>
                  ) : null}
                  {c.pendingProposals ? (
                    <Pill tone="warning">
                      {pluralize(c.pendingProposals, "propuesta", "propuestas")}
                    </Pill>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
