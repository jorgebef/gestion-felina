import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  Database,
  ListTodo,
  Mail,
  Sparkles,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

import { EmptyState, PageHeader } from "@/components/app/states";
import { Deadline, WorkflowBadge } from "@/components/tenders/badges";
import { TenderList } from "@/components/tenders/TenderList";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatInteger, formatRelativeDays, pluralize } from "@/lib/format";
import { dashboardQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/dashboard")({
  validateSearch: z.object({ welcome: z.boolean().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "Panel · Licita" }] }),
  component: Dashboard,
});

function Stat({
  label,
  value,
  icon: Icon,
  to,
  hint,
}: {
  label: string;
  value: number;
  icon: typeof Target;
  to: "/oportunidades" | "/mis-licitaciones";
  hint?: string;
}) {
  return (
    <Link to={to} className="surface group block p-4 transition-colors hover:border-brand/40">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        <Icon className="size-4" />
      </div>
      <p className="tabular mt-2 text-3xl font-semibold tracking-tight">{formatInteger(value)}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { welcome } = Route.useSearch();
  const { company } = Route.useRouteContext();

  return (
    <>
      <PageHeader
        eyebrow={company.name}
        title="Panel"
        description="Resumen de tus oportunidades, seguimientos y avisos."
        actions={
          <Button asChild variant="outline" className="bg-card">
            <Link to="/licitaciones">Buscar licitaciones</Link>
          </Button>
        }
      />

      {welcome ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-positive/20 bg-positive-soft p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
          <div>
            <p className="font-medium text-positive">Perfil guardado</p>
            <p className="text-foreground/80">
              Hemos comparado tu perfil con las licitaciones abiertas. A partir de ahora, cada nueva
              publicación se evalúa automáticamente y recibirás los avisos según la frecuencia
              elegida.
            </p>
          </div>
        </div>
      ) : null}

      {data.profiles.total === 0 ? (
        <EmptyState
          className="mb-6"
          icon={BellRing}
          title="Crea tu primer perfil de alertas"
          description="Describe qué hace tu empresa y dónde trabaja para empezar a recibir oportunidades."
          action={
            <Button asChild>
              <Link to="/alertas/nueva">Crear perfil</Link>
            </Button>
          }
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Nuevas esta semana"
          value={data.stats.newThisWeek}
          icon={Sparkles}
          to="/oportunidades"
        />
        <Stat
          label="Oportunidades abiertas"
          value={data.stats.activeOpportunities}
          icon={Target}
          to="/oportunidades"
        />
        <Stat
          label="Licitaciones guardadas"
          value={data.stats.saved}
          icon={Bookmark}
          to="/mis-licitaciones"
        />
        <Stat
          label="Vencen en 14 días"
          value={data.stats.dueSoon}
          icon={CalendarClock}
          to="/mis-licitaciones"
          hint="De tus licitaciones guardadas"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Nuevas oportunidades relevantes</h2>
            <Link
              to="/oportunidades"
              className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              Ver todas <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {data.newMatches.length ? (
            <TenderList
              showScore
              rows={data.newMatches.map((m) => ({
                id: m.tenderId,
                title: m.title,
                authorityName: m.authorityName,
                status: m.status,
                contractType: m.contractType,
                executionProvinces: m.executionProvinces,
                baseBudgetExVatEur: m.baseBudgetExVatEur,
                submissionDeadlineAt: m.submissionDeadlineAt,
                score: m.score,
                trackedStatus: m.trackedStatus,
                note: (
                  <>
                    <span className="font-medium text-foreground/70">{m.profileName}</span>
                    {m.matchReason ? ` · ${m.matchReason.split("\n")[0]}` : null}
                  </>
                ),
              }))}
            />
          ) : (
            <EmptyState
              icon={Target}
              title="Aún no hay oportunidades abiertas para tus perfiles"
              description="Revisamos cada nueva licitación publicada. Si tarda en aparecer algo, prueba a ampliar provincias, palabras clave o códigos CPV."
              action={
                <Button asChild variant="outline">
                  <Link to="/alertas">Revisar perfiles</Link>
                </Button>
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <Panel
            title="Próximos vencimientos"
            action={
              <Link to="/mis-licitaciones" className="text-sm text-brand hover:underline">
                Mis licitaciones
              </Link>
            }
          >
            {data.deadlines.length ? (
              <ul className="space-y-3">
                {data.deadlines.map((d) => (
                  <li key={d.tenderId} className="text-sm">
                    <Link
                      to="/licitaciones/$tenderId"
                      params={{ tenderId: d.tenderId }}
                      className="line-clamp-2 font-medium hover:text-brand"
                    >
                      {d.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <Deadline value={d.submissionDeadlineAt} compact />
                      <WorkflowBadge status={d.workflowStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Guarda licitaciones para ver aquí sus fechas límite.
              </p>
            )}
          </Panel>

          <Panel title="Tareas pendientes">
            {data.tasks.length ? (
              <ul className="space-y-3">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex gap-2 text-sm">
                    <ListTodo className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium">{t.title}</p>
                      <Link
                        to="/licitaciones/$tenderId"
                        params={{ tenderId: t.tenderId }}
                        className="line-clamp-1 text-xs text-muted-foreground hover:text-brand"
                      >
                        {t.tenderTitle}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(t.dueAt)} ({formatRelativeDays(t.dueAt)})
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin tareas con fecha.</p>
            )}
          </Panel>

          <Panel title="Últimos avisos">
            {data.alerts.length ? (
              <ul className="space-y-2.5">
                {data.alerts.map((a, i) => (
                  <li key={`${a.providerMessageId ?? "x"}-${i}`} className="flex gap-2 text-sm">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p>
                        {a.notificationType === "test"
                          ? "Correo de prueba"
                          : pluralize(a.tenders, "licitación enviada", "licitaciones enviadas")}
                        {a.status === "failed" ? (
                          <span className="ml-1.5 text-xs text-negative">(error de envío)</span>
                        ) : a.status === "queued" ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">(en cola)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no te hemos enviado avisos. Puedes probarlo desde{" "}
                <Link to="/ajustes" className="text-brand hover:underline">
                  Ajustes
                </Link>
                .
              </p>
            )}
          </Panel>

          <ImportStatus lastImport={data.lastImport} />
        </div>
      </div>
    </>
  );
}

function ImportStatus({
  lastImport,
}: {
  lastImport: {
    status: string;
    finishedAt: string | null;
    startedAt: string;
    tendersCreated: number;
    tendersUpdated: number;
  } | null;
}) {
  return (
    <div className="flex gap-2 rounded-xl border bg-card p-4 text-xs text-muted-foreground">
      <Database className="mt-0.5 size-4 shrink-0" />
      {lastImport ? (
        <p>
          Datos de la Plataforma de Contratación del Sector Público. Última actualización{" "}
          {formatDateTime(lastImport.finishedAt ?? lastImport.startedAt)}
          {lastImport.status === "failed" ? " (con errores; reintentando)" : ""}:{" "}
          {formatInteger(lastImport.tendersCreated)} nuevas,{" "}
          {formatInteger(lastImport.tendersUpdated)} actualizadas.
        </p>
      ) : (
        <p>Todavía no se ha importado ninguna licitación.</p>
      )}
    </div>
  );
}
