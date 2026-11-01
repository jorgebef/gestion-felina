import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileText,
  History,
  Info,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  ContractTypeLabel,
  Deadline,
  ScoreBadge,
  TenderStatusBadge,
} from "@/components/tenders/badges";
import { TrackButton } from "@/components/tenders/TrackButton";
import { TrackingPanel } from "@/components/tracking/TrackingPanel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { provinceName } from "@licita/domain/provinces";
import {
  EVENT_TYPE_LABELS,
  PROCEDURE_LABELS,
  SOURCE_PLATFORM_LABELS,
  TENDER_STATUS_LABELS,
} from "@licita/domain/tenders";
import { api } from "@/lib/api";
import { errorMessage, isNotFound } from "@/lib/errors";
import { formatDate, formatDateTime, formatEuros } from "@/lib/format";
import { tenderQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/licitaciones/$tenderId")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.tenderId)) throw notFound();
    try {
      const data = await context.queryClient.ensureQueryData(tenderQuery(params.tenderId));
      return { title: data.tender.title };
    } catch (error) {
      if (isNotFound(error)) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Licitación"} · Licita` }],
  }),
  component: TenderDetailPage,
});

function formatChange(field: string, value: string | null): string {
  if (value == null) return "—";
  if (field === "submissionDeadlineAt") return formatDateTime(value);
  if (field.endsWith("Eur")) return formatEuros(Number(value), true);
  if (field === "status")
    return TENDER_STATUS_LABELS[value as keyof typeof TENDER_STATUS_LABELS] ?? value;
  return value;
}

function Fact({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`Qué es: ${label}`}>
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{hint}</TooltipContent>
          </Tooltip>
        ) : null}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: typeof FileText;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface p-5", className)}>
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

function MatchFeedback({
  id,
  feedback,
  tenderId,
}: {
  id: string;
  feedback: string | null;
  tenderId: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: "relevant" | "irrelevant" | null) => api().matches.setFeedback(id, value),
    onSuccess: async () => {
      toast.success("Gracias, lo tendremos en cuenta");
      await queryClient.invalidateQueries({ queryKey: ["tenders", tenderId] });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">¿Te resulta útil?</span>
      <Button
        size="xs"
        variant="outline"
        className={cn(
          feedback === "relevant" && "border-positive/30 bg-positive-soft text-positive",
        )}
        onClick={() => mutation.mutate(feedback === "relevant" ? null : "relevant")}
        aria-pressed={feedback === "relevant"}
      >
        <ThumbsUp /> Sí
      </Button>
      <Button
        size="xs"
        variant="outline"
        className={cn(
          feedback === "irrelevant" && "border-negative/30 bg-negative-soft text-negative",
        )}
        onClick={() => mutation.mutate(feedback === "irrelevant" ? null : "irrelevant")}
        aria-pressed={feedback === "irrelevant"}
      >
        <ThumbsDown /> No
      </Button>
    </div>
  );
}

function TenderDetailPage() {
  const { tenderId } = Route.useParams();
  const { data } = useSuspenseQuery(tenderQuery(tenderId));
  if (!data) return null;
  const { tender, authority, lots, events, sources, matches, tracked, cpvOptions } = data;
  const summary = tender.rawSummary;
  const officialUrl = tender.primaryOfficialUrl ?? sources[0]?.officialUrl;
  const provinces = tender.executionProvinces.map((p) => provinceName(p) ?? p);

  return (
    <>
      <Link
        to="/licitaciones"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Buscador
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <TenderStatusBadge status={tender.status} />
          {tender.expedienteNumber ? <span>Expediente {tender.expedienteNumber}</span> : null}
          {tender.firstPublishedAt ? (
            <span>· Publicada el {formatDate(tender.firstPublishedAt)}</span>
          ) : null}
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {tender.title}
        </h1>
        {authority ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-4 shrink-0" />
            {authority.name}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <TrackButton tenderId={tender.id} tracked={Boolean(tracked)} size="default" />
          {officialUrl ? (
            <Button asChild variant="default">
              <a href={officialUrl} target="_blank" rel="noopener noreferrer">
                Ver expediente oficial <ExternalLink />
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card title="Datos principales">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact
                label="Presupuesto base de licitación (sin IVA)"
                hint="Importe máximo que el organismo está dispuesto a pagar, sin impuestos. Es la referencia para tu oferta."
              >
                <span className="tabular text-base">
                  {formatEuros(tender.baseBudgetExVatEur, true)}
                </span>
              </Fact>
              <Fact
                label="Valor estimado del contrato"
                hint="Importe total previsto incluyendo posibles prórrogas y modificaciones, sin IVA. Determina umbrales y procedimientos; no es lo que cobrarás."
              >
                <span className="tabular">{formatEuros(tender.estimatedValueEur, true)}</span>
              </Fact>
              {summary.totalAmountWithVatEur != null ? (
                <Fact label="Presupuesto con impuestos">
                  <span className="tabular">
                    {formatEuros(summary.totalAmountWithVatEur, true)}
                  </span>
                </Fact>
              ) : null}
              <Fact label="Fecha límite de presentación">
                <Deadline value={tender.submissionDeadlineAt} />
              </Fact>
              <Fact label="Tipo de contrato">
                {summary.contractTypeLabel ?? <ContractTypeLabel type={tender.contractType} />}
              </Fact>
              <Fact label="Procedimiento">
                {tender.procedureType
                  ? (PROCEDURE_LABELS[tender.procedureType] ?? tender.procedureType)
                  : "—"}
              </Fact>
              <Fact label="Lugar de ejecución">
                {provinces.length
                  ? provinces.join(", ")
                  : summary.executionScope === "national"
                    ? "Ámbito nacional"
                    : "No especificado"}
                {tender.executionMunicipality ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {tender.executionMunicipality}
                  </span>
                ) : null}
              </Fact>
              {summary.durationText ? <Fact label="Duración">{summary.durationText}</Fact> : null}
            </dl>
            {summary.deadlineNote ? (
              <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">Nota sobre la presentación:</strong>{" "}
                {summary.deadlineNote}
              </p>
            ) : null}
            {tender.description ? (
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">
                {tender.description}
              </p>
            ) : null}
            {cpvOptions.length ? (
              <div className="mt-5">
                <p className="text-xs text-muted-foreground">Códigos CPV</p>
                <ul className="mt-1.5 space-y-1">
                  {cpvOptions.map((c) => (
                    <li key={c.code} className="flex gap-2 text-sm">
                      <Link
                        to="/licitaciones"
                        search={{ cpv: c.code, status: "active" }}
                        className="tabular shrink-0 font-mono text-xs text-brand hover:underline"
                      >
                        {c.code}
                      </Link>
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {lots.length ? (
            <Card title={`Lotes (${lots.length})`}>
              <div className="-mx-5 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 pl-5">Lote</TableHead>
                      <TableHead>Objeto</TableHead>
                      <TableHead className="text-right">Presupuesto sin IVA</TableHead>
                      <TableHead className="pr-5">CPV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => {
                      const highlighted = matches.some((m) =>
                        m.matchedLotCodes.includes(lot.sourceLotCode),
                      );
                      return (
                        <TableRow key={lot.id} className={cn(highlighted && "bg-brand-soft/50")}>
                          <TableCell className="pl-5 font-medium">{lot.sourceLotCode}</TableCell>
                          <TableCell className="min-w-56 whitespace-normal">
                            {lot.title ?? "—"}
                          </TableCell>
                          <TableCell className="tabular text-right">
                            {formatEuros(lot.baseBudgetExVatEur, true)}
                          </TableCell>
                          <TableCell className="pr-5 font-mono text-xs">
                            {lot.cpvCodes.join(", ") || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {matches.some((m) => m.matchedLotCodes.length) ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Resaltados: lotes más afines a tus perfiles.
                </p>
              ) : null}
            </Card>
          ) : null}

          {summary.documents?.length ? (
            <Card title="Documentos publicados" icon={FileText}>
              <ul className="divide-y">
                {summary.documents.map((d) => (
                  <li key={d.url} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d.kind}</span>
                    </span>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-brand hover:underline"
                    >
                      Abrir <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {summary.results?.length ? (
            <Card title="Resultado" icon={Trophy}>
              <ul className="space-y-2 text-sm">
                {summary.results.map((r, i) => (
                  <li key={i} className="rounded-lg bg-muted/60 p-3">
                    <span className="font-medium">
                      {r.lot ? `Lote ${r.lot}: ` : ""}
                      {r.result ?? "—"}
                    </span>
                    {r.winner ? <span> · {r.winner}</span> : null}
                    {r.amountExVatEur != null ? (
                      <span className="tabular">
                        {" "}
                        · {formatEuros(r.amountExVatEur, true)} sin IVA
                      </span>
                    ) : null}
                    {r.awardDate ? (
                      <span className="block text-xs text-muted-foreground">
                        Fecha: {formatDate(r.awardDate)}
                        {r.receivedTenders ? ` · ${r.receivedTenders} ofertas recibidas` : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Anuncios y cambios" icon={History}>
            {events.length ? (
              <ol className="relative space-y-4 border-l pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-brand" />
                    <p className="font-medium">
                      {e.headline ?? EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.effectiveAt ? formatDate(e.effectiveAt) : "Fecha no indicada"}
                      {typeof e.payload.media === "string" ? ` · ${e.payload.media}` : ""}
                    </p>
                    {e.eventType === "change_detected" && e.payload.changes ? (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(e.payload.changes).map(([field, c]) => (
                          <li key={field}>
                            {c.label}: {formatChange(field, c.from)} → {formatChange(field, c.to)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {e.details ? <p className="mt-1 text-xs">{e.details}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Sin anuncios registrados.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {matches.length ? (
            <Card title="Por qué te lo mostramos">
              <ul className="space-y-4">
                {matches.map((m) => (
                  <li key={m.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.profileName}</span>
                      <ScoreBadge score={m.score} />
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {(m.matchReason ?? "")
                        .split("\n")
                        .filter(Boolean)
                        .map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                    </ul>
                    <div className="mt-3">
                      <MatchFeedback id={m.id} feedback={m.feedback} tenderId={tender.id} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                La relevancia no es una probabilidad de adjudicación ni valida tu capacidad legal
                para licitar.
              </p>
            </Card>
          ) : null}

          {tracked ? <TrackingPanel tenderId={tender.id} /> : null}

          {authority ? (
            <Card title="Organismo de contratación" icon={Building2}>
              <dl className="space-y-3 text-sm">
                <Fact label="Nombre">{authority.name}</Fact>
                {authority.administrationType ? (
                  <Fact label="Tipo">{authority.administrationType}</Fact>
                ) : null}
                {authority.municipality ? (
                  <Fact label="Localidad">{authority.municipality}</Fact>
                ) : null}
                {authority.taxId ? <Fact label="NIF">{authority.taxId}</Fact> : null}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/licitaciones" search={{ authority: authority.id, status: "all" }}>
                    Otras licitaciones
                  </Link>
                </Button>
                {authority.profileUrl ? (
                  <Button asChild size="sm" variant="ghost">
                    <a href={authority.profileUrl} target="_blank" rel="noopener noreferrer">
                      Perfil del contratante <ExternalLink />
                    </a>
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card title="Procedencia de los datos" icon={ShieldCheck}>
            <ul className="space-y-3 text-sm">
              {sources.map((s) => (
                <li key={s.id}>
                  <p className="font-medium">
                    {SOURCE_PLATFORM_LABELS[s.sourcePlatform] ?? s.sourcePlatform}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID en la fuente: {s.externalRecordId}
                    <br />
                    Actualizado en la fuente: {formatDateTime(s.sourceUpdatedAt)}
                    <br />
                    Última comprobación: {formatDateTime(s.lastSeenAt)}
                  </p>
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                  >
                    Abrir en la fuente <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Información obtenida de fuentes oficiales. Antes de presentar una oferta, comprueba
              siempre plazos y requisitos en el expediente oficial.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
