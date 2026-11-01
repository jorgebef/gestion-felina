import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Cat, Plus, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { CAT_SEXES, CAT_SEX_LABELS } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/states";
import { CatCard } from "@/components/felina/CatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pluralize } from "@/lib/format";
import { catsQuery, coloniesQuery } from "@/lib/queries";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  colonyId: z.uuid().optional().catch(undefined),
  colony: z.enum(["none"]).optional().catch(undefined),
  sex: z.enum(CAT_SEXES).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/gatos/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: `Gatos · ${APP_NAME}` }] }),
  component: Cats,
});

function Cats() {
  const { membership } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState(search.q ?? "");
  const query = useQuery(catsQuery(search));
  const colonies = useQuery(coloniesQuery());
  const townHall = membership.organization.kind === "town_hall";
  const colonyFilter = search.colony === "none" ? "none" : (search.colonyId ?? "all");

  return (
    <>
      <PageHeader
        title="Gatos"
        description={
          townHall
            ? "Gatos registrados en tu municipio."
            : query.data
              ? pluralize(query.data.length, "gato registrado", "gatos registrados")
              : undefined
        }
        actions={
          !townHall ? (
            <Button asChild>
              <Link to="/gatos/nuevo">
                <Plus /> Nuevo gato
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
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
            placeholder="Buscar por nombre o descripción"
            aria-label="Buscar gatos"
            className="bg-card pl-9"
          />
        </form>
        <Select
          value={colonyFilter}
          onValueChange={(v) =>
            void navigate({
              search: (s) => ({
                ...s,
                colonyId: v === "all" || v === "none" ? undefined : v,
                colony: v === "none" ? ("none" as const) : undefined,
              }),
            })
          }
        >
          <SelectTrigger className="w-full bg-card sm:w-56" aria-label="Colonia">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las colonias</SelectItem>
            <SelectItem value="none">Sin colonia</SelectItem>
            {colonies.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.sex ?? "all"}
          onValueChange={(v) =>
            void navigate({
              search: (s) => ({
                ...s,
                sex: v === "all" ? undefined : (v as (typeof CAT_SEXES)[number]),
              }),
            })
          }
        >
          <SelectTrigger className="w-full bg-card sm:w-40" aria-label="Sexo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ambos sexos</SelectItem>
            {CAT_SEXES.map((s) => (
              <SelectItem key={s} value={s}>
                {CAT_SEX_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {query.data.map((cat) => (
            <li key={cat.id}>
              <CatCard cat={cat} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Cat}
          title="No hay gatos con estos filtros"
          action={
            !townHall ? (
              <Button asChild>
                <Link to="/gatos/nuevo">Registrar un gato</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}
