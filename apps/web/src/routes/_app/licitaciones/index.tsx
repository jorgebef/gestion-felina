import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileSearch, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/states";
import { AuthorityPicker } from "@/components/tenders/AuthorityPicker";
import { Pagination, TenderList } from "@/components/tenders/TenderList";
import { TrackButton } from "@/components/tenders/TrackButton";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { provinceName, provincesByRegion } from "@licita/domain/provinces";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  TENDER_STATUSES,
  TENDER_STATUS_LABELS,
} from "@licita/domain/tenders";
import { formatEuros } from "@/lib/format";
import { tenderSearchQuery } from "@/lib/queries";
import { tenderSearchSchema, type TenderSearch } from "@licita/schemas/tender-search";

export const Route = createFileRoute("/_app/licitaciones/")({
  validateSearch: tenderSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(tenderSearchQuery(deps)),
  head: () => ({ meta: [{ title: "Buscador de licitaciones · Licita" }] }),
  component: TenderSearchPage,
});

const REGIONS = provincesByRegion();
const ANY = "__any";

type Draft = Record<
  | "cpv"
  | "type"
  | "province"
  | "status"
  | "minBudget"
  | "maxBudget"
  | "publishedFrom"
  | "publishedTo"
  | "deadlineFrom"
  | "deadlineTo",
  string
> & { authority?: { id: string; name: string } };

function draftFrom(search: TenderSearch, authorityName?: string): Draft {
  return {
    cpv: search.cpv ?? "",
    type: search.type ?? "",
    province: search.province ?? "",
    status: search.status ?? "active",
    minBudget: search.minBudget?.toString() ?? "",
    maxBudget: search.maxBudget?.toString() ?? "",
    publishedFrom: search.publishedFrom ?? "",
    publishedTo: search.publishedTo ?? "",
    deadlineFrom: search.deadlineFrom ?? "",
    deadlineTo: search.deadlineTo ?? "",
    authority:
      search.authority && authorityName ? { id: search.authority, name: authorityName } : undefined,
  };
}

function num(v: string): number | undefined {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return v.trim() && Number.isFinite(n) ? n : undefined;
}

function TenderSearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery(tenderSearchQuery(search));
  const authorityName = query.data?.authority?.name;
  const [q, setQ] = useState(search.q ?? "");
  const [draft, setDraft] = useState(() => draftFrom(search, authorityName));
  const advancedCount = [
    search.cpv,
    search.type,
    search.province,
    search.authority,
    search.minBudget,
    search.maxBudget,
    search.publishedFrom,
    search.publishedTo,
    search.deadlineFrom,
    search.deadlineTo,
    search.status && search.status !== "active" ? search.status : undefined,
  ].filter((v) => v != null && v !== "").length;
  const [showFilters, setShowFilters] = useState(advancedCount > 0);

  useEffect(() => {
    setQ(search.q ?? "");
    setDraft(draftFrom(search, authorityName));
  }, [search, authorityName]);

  const apply = (next: Partial<TenderSearch>) =>
    void navigate({ search: (s) => ({ ...s, ...next, page: undefined }) });

  const applyDraft = () =>
    apply({
      q: q.trim() || undefined,
      cpv: /^\d{2,8}$/.test(draft.cpv.trim()) ? draft.cpv.trim() : undefined,
      type: (draft.type || undefined) as TenderSearch["type"],
      province: draft.province || undefined,
      status: (draft.status || undefined) as TenderSearch["status"],
      minBudget: num(draft.minBudget),
      maxBudget: num(draft.maxBudget),
      publishedFrom: draft.publishedFrom || undefined,
      publishedTo: draft.publishedTo || undefined,
      deadlineFrom: draft.deadlineFrom || undefined,
      deadlineTo: draft.deadlineTo || undefined,
      authority: draft.authority?.id,
    });

  type Chip = { label: string; clear: Partial<TenderSearch> };
  const candidates: (Chip | null)[] = [
    search.cpv ? { label: `CPV ${search.cpv}…`, clear: { cpv: undefined } } : null,
    search.type ? { label: CONTRACT_TYPE_LABELS[search.type], clear: { type: undefined } } : null,
    search.province
      ? { label: provinceName(search.province) ?? search.province, clear: { province: undefined } }
      : null,
    search.authority
      ? { label: authorityName ?? "Organismo", clear: { authority: undefined } }
      : null,
    search.minBudget != null
      ? { label: `Desde ${formatEuros(search.minBudget)}`, clear: { minBudget: undefined } }
      : null,
    search.maxBudget != null
      ? { label: `Hasta ${formatEuros(search.maxBudget)}`, clear: { maxBudget: undefined } }
      : null,
    search.publishedFrom || search.publishedTo
      ? {
          label: `Publicada ${search.publishedFrom ?? "…"} – ${search.publishedTo ?? "…"}`,
          clear: { publishedFrom: undefined, publishedTo: undefined },
        }
      : null,
    search.deadlineFrom || search.deadlineTo
      ? {
          label: `Plazo ${search.deadlineFrom ?? "…"} – ${search.deadlineTo ?? "…"}`,
          clear: { deadlineFrom: undefined, deadlineTo: undefined },
        }
      : null,
    search.status && search.status !== "active"
      ? {
          label:
            search.status === "all" ? "Todos los estados" : TENDER_STATUS_LABELS[search.status],
          clear: { status: undefined },
        }
      : null,
  ];
  const chips = candidates.filter((c): c is Chip => c !== null);

  return (
    <>
      <PageHeader
        title="Buscador de licitaciones"
        description="Todas las licitaciones importadas de fuentes oficiales. Por defecto, solo las que siguen en plazo."
      />

      <form
        className="surface p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          applyDraft();
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Palabras del título o la descripción: «limpieza colegios», «alumbrado -suministro»"
              aria-label="Buscar por palabras"
              className="h-10 pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 sm:flex-none"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal />
              Filtros{advancedCount ? ` (${advancedCount})` : ""}
            </Button>
            <Button type="submit" className="h-10 flex-1 sm:flex-none">
              Buscar
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="f-status" label="Estado">
              <Select
                value={draft.status}
                onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
              >
                <SelectTrigger id="f-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">En plazo y anuncios previos</SelectItem>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {TENDER_STATUSES.filter((s) => s !== "unknown").map((s) => (
                    <SelectItem key={s} value={s}>
                      {TENDER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="f-type" label="Tipo de contrato">
              <Select
                value={draft.type || ANY}
                onValueChange={(v) => setDraft((d) => ({ ...d, type: v === ANY ? "" : v }))}
              >
                <SelectTrigger id="f-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Cualquiera</SelectItem>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CONTRACT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="f-province" label="Provincia de ejecución">
              <Select
                value={draft.province || ANY}
                onValueChange={(v) => setDraft((d) => ({ ...d, province: v === ANY ? "" : v }))}
              >
                <SelectTrigger id="f-province" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ANY}>Cualquiera</SelectItem>
                  {REGIONS.map((g) => (
                    <SelectGroup key={g.region}>
                      <SelectLabel>{g.region}</SelectLabel>
                      {g.provinces.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="f-cpv" label="Código CPV" hint="Incluye los subcódigos (p. ej. 4521).">
              <Input
                id="f-cpv"
                inputMode="numeric"
                value={draft.cpv}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, cpv: e.target.value.replace(/\D/g, "").slice(0, 8) }))
                }
                placeholder="p. ej. 90910000"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id="f-authority" label="Organismo de contratación">
                <AuthorityPicker
                  id="f-authority"
                  value={draft.authority}
                  onChange={(authority) => setDraft((d) => ({ ...d, authority }))}
                />
              </Field>
            </div>
            <Field id="f-min" label="Presupuesto mín. (sin IVA)">
              <Input
                id="f-min"
                inputMode="decimal"
                value={draft.minBudget}
                onChange={(e) => setDraft((d) => ({ ...d, minBudget: e.target.value }))}
                placeholder="€"
              />
            </Field>
            <Field id="f-max" label="Presupuesto máx. (sin IVA)">
              <Input
                id="f-max"
                inputMode="decimal"
                value={draft.maxBudget}
                onChange={(e) => setDraft((d) => ({ ...d, maxBudget: e.target.value }))}
                placeholder="€"
              />
            </Field>
            <Field id="f-pub-from" label="Publicada desde">
              <Input
                id="f-pub-from"
                type="date"
                value={draft.publishedFrom}
                onChange={(e) => setDraft((d) => ({ ...d, publishedFrom: e.target.value }))}
              />
            </Field>
            <Field id="f-pub-to" label="Publicada hasta">
              <Input
                id="f-pub-to"
                type="date"
                value={draft.publishedTo}
                onChange={(e) => setDraft((d) => ({ ...d, publishedTo: e.target.value }))}
              />
            </Field>
            <Field id="f-dl-from" label="Fecha límite desde">
              <Input
                id="f-dl-from"
                type="date"
                value={draft.deadlineFrom}
                onChange={(e) => setDraft((d) => ({ ...d, deadlineFrom: e.target.value }))}
              />
            </Field>
            <Field id="f-dl-to" label="Fecha límite hasta">
              <Input
                id="f-dl-to"
                type="date"
                value={draft.deadlineTo}
                onChange={(e) => setDraft((d) => ({ ...d, deadlineTo: e.target.value }))}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQ("");
                  void navigate({ search: {} });
                }}
              >
                Limpiar filtros
              </Button>
              <Button type="submit">Aplicar filtros</Button>
            </div>
          </div>
        ) : null}
      </form>

      <div className="mt-4 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {query.data ? (
            <span className="text-muted-foreground">
              {query.data.total.toLocaleString("es-ES")} licitaciones
              {query.isFetching ? <Loader2 className="ml-2 inline size-3.5 animate-spin" /> : null}
            </span>
          ) : null}
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => apply(chip.clear)}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs hover:bg-accent"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
        <Select
          value={search.sort ?? (search.q ? "relevance" : "recent")}
          onValueChange={(v) => apply({ sort: v as TenderSearch["sort"] })}
        >
          <SelectTrigger className="w-full bg-card sm:w-56" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="deadline">Fecha límite más próxima</SelectItem>
            <SelectItem value="relevance">Relevancia</SelectItem>
            <SelectItem value="budget">Mayor presupuesto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <LoadingState label="Buscando licitaciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Ninguna licitación coincide con la búsqueda"
          description="Prueba con menos palabras, otra provincia o incluye licitaciones cerradas en «Estado»."
        />
      ) : (
        <>
          <TenderList
            showScore={query.data.items.some((i) => i.bestScore != null)}
            rows={query.data.items.map((t) => ({
              id: t.id,
              title: t.title,
              authorityName: t.authorityName,
              status: t.status,
              contractType: t.contractType,
              executionProvinces: t.executionProvinces,
              baseBudgetExVatEur: t.baseBudgetExVatEur,
              submissionDeadlineAt: t.submissionDeadlineAt,
              firstPublishedAt: t.firstPublishedAt,
              score: t.bestScore,
              trackedStatus: t.trackedStatus,
              actions: <TrackButton tenderId={t.id} tracked={Boolean(t.trackedStatus)} />,
            }))}
          />
          <Pagination
            page={query.data.page}
            pageCount={query.data.pageCount}
            total={query.data.total}
            renderLink={(page, label, disabled) => (
              <Button
                asChild={!disabled}
                variant="outline"
                size="sm"
                disabled={disabled}
                className="bg-card"
              >
                {disabled ? (
                  <span>{label}</span>
                ) : (
                  <Link from={Route.fullPath} search={(s) => ({ ...s, page })}>
                    {label}
                  </Link>
                )}
              </Button>
            )}
          />
        </>
      )}
    </>
  );
}
