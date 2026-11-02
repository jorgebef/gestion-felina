import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Cat, GitPullRequestArrow, MapPinned, Newspaper, Plus } from "lucide-react";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { ActionRow } from "@/components/felina/ActionRow";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { formatInteger, pluralize } from "@/lib/format";
import { dashboardQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/panel")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: `Panel · ${APP_NAME}` }] }),
  component: Dashboard,
});

function Stat({
  label,
  value,
  detail,
  to,
}: {
  label: string;
  value: number;
  detail?: string;
  to?: "/colonias" | "/gatos" | "/acciones" | "/feed" | "/propuestas";
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{formatInteger(value)}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </>
  );
  return to ? (
    <Link to={to} className="surface block p-4 transition-colors hover:border-brand/30">
      {body}
    </Link>
  ) : (
    <div className="surface p-4">{body}</div>
  );
}

function Dashboard() {
  const { membership } = Route.useRouteContext();
  const { data, isFetching } = useSuspenseQuery(dashboardQuery);
  const townHall = data.kind === "town_hall";
  const org = membership.organization;

  return (
    <>
      <PageHeader
        eyebrow={townHall ? `Ayuntamiento · ${org.municipalityName ?? ""}` : "Asociación"}
        title={org.name}
        actions={
          townHall ? (
            <Link to="/feed" className={buttonVariants()}>
              <Newspaper /> Feed de acciones
            </Link>
          ) : (
            <>
              <Link
                to="/gatos/nuevo"
                className={cn(buttonVariants({ variant: "outline" }), "bg-card")}
              >
                <Plus /> Gato
              </Link>
              <Link to="/acciones/nueva" className={buttonVariants()}>
                <Plus /> Acción
              </Link>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={townHall ? "Colonias en el municipio" : "Colonias"}
          value={data.colonies.total}
          detail={pluralize(data.colonies.authorized, "autorizada", "autorizadas")}
          to="/colonias"
        />
        <Stat
          label="Gatos"
          value={data.cats.total}
          detail={pluralize(data.cats.sterilized, "castrado", "castrados")}
          to="/gatos"
        />
        {townHall ? (
          <Stat
            label="Acciones sin validar"
            value={data.actions.pendingValidation}
            detail={`${pluralize(data.actions.doneThisYear, "realizada", "realizadas")} este año`}
            to="/feed"
          />
        ) : (
          <Stat
            label="Acciones abiertas"
            value={data.actions.open}
            detail={pluralize(data.actions.urgentOpen, "urgente", "urgentes")}
            to="/acciones"
          />
        )}
        <Stat
          label={townHall ? "Propuestas pendientes" : "Propuestas por revisar"}
          value={data.pendingProposals}
          detail={townHall ? "Enviadas a asociaciones" : "Del ayuntamiento"}
          to="/propuestas"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface">
          <h2 className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
            <CalendarCheck className="size-4 text-brand" /> Próximas acciones
          </h2>
          {isFetching ? (
            <RowsSkeleton framed={false} badges rows={3} label="Cargando acciones…" />
          ) : data.upcoming.length ? (
            <ul className="divide-y">
              {data.upcoming.map((a) => (
                <ActionRow key={a.id} action={a} showOrganization={townHall} />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="m-4 border-0"
              icon={CalendarCheck}
              title="No hay acciones programadas"
              action={
                !townHall ? (
                  <Link to="/acciones/nueva" className={buttonVariants({ size: "sm" })}>
                    Planificar una acción
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>

        <section className="surface">
          <h2 className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
            {townHall ? (
              <>
                <Newspaper className="size-4 text-brand" /> Pendientes de validar
              </>
            ) : (
              <>
                <GitPullRequestArrow className="size-4 text-brand" /> Validadas recientemente
              </>
            )}
          </h2>
          {isFetching ? (
            <RowsSkeleton framed={false} badges rows={3} label="Cargando acciones…" />
          ) : data.recent.length ? (
            <ul className="divide-y">
              {data.recent.map((a) => (
                <ActionRow key={a.id} action={a} showOrganization={townHall} />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="m-4 border-0"
              icon={townHall ? Newspaper : GitPullRequestArrow}
              title={townHall ? "Todo validado" : "Aún no hay acciones validadas"}
              description={
                townHall
                  ? "Las nuevas acciones de las colonias del municipio aparecerán aquí."
                  : "Cuando el ayuntamiento valide una acción, aparecerá aquí."
              }
            />
          )}
        </section>
      </div>

      {!townHall && data.colonies.total === 0 ? (
        <EmptyState
          className="mt-6"
          icon={MapPinned}
          title="Empieza registrando vuestra primera colonia"
          description="Con su ubicación exacta y el municipio. Después podrás añadir sus gatos."
          action={
            membership.role === "admin" ? (
              <Link to="/colonias/nueva" className={buttonVariants()}>
                Registrar colonia
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {!townHall && data.cats.withoutColony > 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Cat className="size-4" />
          {data.cats.withoutColony === 1
            ? "1 gato no está asignado a ninguna colonia."
            : `${formatInteger(data.cats.withoutColony)} gatos no están asignados a ninguna colonia.`}
        </p>
      ) : null}
    </>
  );
}
