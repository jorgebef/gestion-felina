import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, MapPin, Plus, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";

import { MiniBars } from "#/components/charts/CashFlowChart";
import { Money, TrendBadge } from "#/components/finance";
import { PropertiesTable } from "#/components/properties/PropertiesTable";
import { PropertyTypeIcon } from "#/components/properties/PropertyTypeIcon";
import { Button } from "#/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { formatCurrency, formatPercent } from "#/lib/format";
import { propertyTypeLabel } from "#/lib/labels";
import {
  monthRange,
  portfolioMetrics,
  propertyMetrics,
  toMonthIndex,
  valuationHistory,
} from "#/lib/portfolio";
import type { PropertyData } from "#/lib/portfolio";
import { propertiesQuery } from "#/lib/queries";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/dashboard/properties/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(propertiesQuery),
  head: () => ({ meta: [{ title: `${m.app_nav_properties()} · SpainFolio` }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { data: properties } = useSuspenseQuery(propertiesQuery);
  const now = useMemo(() => new Date(), []);
  const metrics = useMemo(() => portfolioMetrics(properties, now), [properties, now]);
  const [view, setView] = useState<"cards" | "table">("cards");

  return (
    <main className="page-container space-y-6 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">{m.properties_title()}</h1>
          <p className="mt-1 text-muted-foreground">
            {m.properties_subtitle({ count: String(properties.length) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {properties.length ? (
            <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")}>
              <TabsList className="rounded-full">
                <TabsTrigger
                  value="cards"
                  className="rounded-full px-3"
                  aria-label={m.properties_view_cards()}
                >
                  <LayoutGrid />
                </TabsTrigger>
                <TabsTrigger
                  value="table"
                  className="rounded-full px-3"
                  aria-label={m.properties_view_table()}
                >
                  <Rows3 />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
          <Button asChild className="rounded-full">
            <Link to="/dashboard/properties/new">
              <Plus />
              {m.app_add_property()}
            </Link>
          </Button>
        </div>
      </div>

      {properties.length ? (
        <>
          <section className="surface grid grid-cols-2 divide-border/70 p-2 md:grid-cols-4 md:divide-x">
            <SummaryCell
              label={m.dashboard_portfolio_value()}
              value={<Money value={metrics.totalValue} />}
            />
            <SummaryCell
              label={m.kpi_total_invested()}
              value={formatCurrency(metrics.totalInvestment)}
            />
            <SummaryCell
              label={m.kpi_monthly_cash_flow()}
              value={formatCurrency(metrics.monthlyCashFlow, { signed: true })}
            />
            <SummaryCell
              label={m.kpi_net_yield()}
              value={formatPercent(metrics.netYield, { decimals: 2 })}
            />
          </section>

          {view === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} now={now} />
              ))}
              <Link
                to="/dashboard/properties/new"
                className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <span className="grid size-11 place-items-center rounded-full bg-card shadow-sm">
                  <Plus className="size-5" />
                </span>
                <span className="text-sm font-medium">{m.app_add_property()}</span>
              </Link>
            </div>
          ) : (
            <section className="surface p-4">
              <PropertiesTable properties={properties} now={now} />
            </section>
          )}
        </>
      ) : (
        <section className="surface flex flex-col items-center gap-3 px-6 py-20 text-center">
          <PropertyTypeIcon type="apartment" className="size-12" />
          <h2 className="mt-2 text-lg font-medium">{m.dashboard_empty_title()}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{m.dashboard_empty_body()}</p>
          <Button asChild className="mt-3 rounded-full">
            <Link to="/dashboard/properties/new">
              <Plus />
              {m.dashboard_empty_cta()}
            </Link>
          </Button>
        </section>
      )}
    </main>
  );
}

function SummaryCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="figure mt-1 text-xl font-medium">{value}</p>
    </div>
  );
}

function PropertyCard({ property: p, now }: { property: PropertyData; now: Date }) {
  const metrics = propertyMetrics(p, now);
  const current = toMonthIndex(now);
  const history = valuationHistory(p, monthRange(current - 11, current), current);

  return (
    <Link
      to="/dashboard/properties/$propertyId"
      params={{ propertyId: p.id }}
      className="surface group flex flex-col gap-5 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(21,19,15,0.25)]"
    >
      <div className="flex items-start gap-3">
        <PropertyTypeIcon type={p.type} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {p.city} · {propertyTypeLabel(p.type)}
          </p>
        </div>
        <TrendBadge value={metrics.appreciationPct} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{m.kpi_current_value()}</p>
        <p className="mt-1 text-[28px] leading-none font-medium">
          <Money value={p.currentValue} />
        </p>
        <MiniBars
          values={history.map((h) => h.value)}
          highlightLast={1}
          tone="brand"
          className="mt-4 h-14"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border/70 pt-4 text-xs">
        <CardStat
          label={m.table_cash_flow()}
          value={formatCurrency(metrics.monthlyCashFlow, { signed: true })}
          className={metrics.monthlyCashFlow < 0 ? "text-negative" : "text-positive"}
        />
        <CardStat label={m.kpi_net_yield()} value={formatPercent(metrics.netYield)} />
        <CardStat
          label={m.kpi_equity()}
          value={formatCurrency(metrics.equity, { compact: true })}
        />
      </div>
    </Link>
  );
}

function CardStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-muted-foreground">{label}</p>
      <p className={cn("figure mt-0.5 truncate text-sm font-medium", className)}>{value}</p>
    </div>
  );
}
