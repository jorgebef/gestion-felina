import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  Landmark,
  Loader2,
  Percent,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AllocationChart } from "#/components/charts/AllocationChart";
import { CashFlowChart } from "#/components/charts/CashFlowChart";
import { YearlyGrowthChart } from "#/components/charts/GrowthCharts";
import { PortfolioValueChart } from "#/components/charts/PortfolioValueChart";
import { KeyValue, Money, SectionHeader, StatCard, TrendBadge } from "#/components/finance";
import { PropertiesTable } from "#/components/properties/PropertiesTable";
import { PropertyTypeIcon } from "#/components/properties/PropertyTypeIcon";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { formatCurrency, formatMonth, formatPercent, intlLocale } from "#/lib/format";
import { propertyTypeLabel } from "#/lib/labels";
import {
  cashFlowForMonth,
  cashFlowSeries,
  monthRange,
  portfolioMetrics,
  portfolioValueSeries,
  propertyMetrics,
  toMonthIndex,
  yearlyValueSeries,
} from "#/lib/portfolio";
import type { PropertyData } from "#/lib/portfolio";
import { propertiesQuery } from "#/lib/queries";
import { m } from "#/paraglide/messages";
import { getLocale } from "#/paraglide/runtime";
import { createSamplePortfolio } from "#/server/properties";

export const Route = createFileRoute("/dashboard/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(propertiesQuery),
  component: Overview,
});

type Range = "12" | "24" | "all";
type AllocationBy = "city" | "type";

function Overview() {
  const { user } = Route.useRouteContext();
  const { data: properties } = useSuspenseQuery(propertiesQuery);
  const now = useMemo(() => new Date(), []);
  const metrics = useMemo(() => portfolioMetrics(properties, now), [properties, now]);
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <main className="page-container space-y-5 pt-2">
      <OverviewHero
        name={firstName}
        now={now}
        metrics={metrics}
        hasProperties={properties.length > 0}
      />
      {properties.length ? (
        <PortfolioOverview properties={properties} now={now} metrics={metrics} />
      ) : (
        <EmptyPortfolio />
      )}
    </main>
  );
}

/* ---------------------------------- Hero ---------------------------------- */

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return m.dashboard_good_morning;
  if (hour < 20) return m.dashboard_good_afternoon;
  return m.dashboard_good_evening;
}

function OverviewHero({
  name,
  now,
  metrics,
  hasProperties,
}: {
  name: string;
  now: Date;
  metrics: ReturnType<typeof portfolioMetrics>;
  hasProperties: boolean;
}) {
  const today = new Intl.DateTimeFormat(intlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <section className="hero-gradient relative overflow-hidden rounded-[2rem] px-6 pt-8 pb-8 text-white sm:px-10 sm:pt-10">
      <div className="hero-grain pointer-events-none absolute inset-0" />
      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <p className="text-sm text-white/70 first-letter:uppercase">{today}</p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
            {greeting(now)({ name })}
          </h1>
          <p className="mt-3 max-w-md text-white/75">{m.dashboard_subtitle()}</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button
              asChild
              className="h-11 rounded-full bg-white px-5 text-foreground hover:bg-white/90"
            >
              <Link to="/dashboard/properties/new">
                <Plus />
                {m.app_add_property()}
              </Link>
            </Button>
            {hasProperties ? (
              <Button
                asChild
                variant="ghost"
                className="h-11 rounded-full bg-white/12 px-5 text-white ring-1 ring-white/25 hover:bg-white/20 hover:text-white"
              >
                <Link to="/dashboard/properties">
                  <Building2 />
                  {m.dashboard_view_properties()}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-6 -top-3 h-16 rounded-3xl bg-white/10" />
          <div className="relative rounded-3xl bg-white/14 p-6 ring-1 ring-white/25 backdrop-blur-md">
            <div className="flex items-center justify-between text-sm text-white/75">
              <span>{m.dashboard_portfolio_value()}</span>
              <span className="figure">
                {m.dashboard_property_count({ count: String(metrics.propertyCount) })}
              </span>
            </div>
            <p className="mt-3 text-[40px] leading-none font-medium sm:text-5xl">
              <Money value={metrics.totalValue} fractionClassName="opacity-55" />
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/75">
              <TrendBadge value={metrics.yoyGrowthPct} variant="glass" />
              <span>{m.dashboard_yoy_label()}</span>
              <span className="text-white/40">·</span>
              <TrendBadge value={metrics.monthOverMonthPct} variant="glass" decimals={2} />
              <span>{m.dashboard_mom_label()}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Empty state ------------------------------ */

function EmptyPortfolio() {
  const queryClient = useQueryClient();
  const sample = useMutation({
    mutationFn: () => createSamplePortfolio({ data: { locale: getLocale() } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success(m.dashboard_sample_loaded());
    },
    onError: () => toast.error(m.error_generic()),
  });

  return (
    <section className="surface grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div>
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Building2 className="size-5" />
        </span>
        <h2 className="mt-6 text-2xl font-medium tracking-tight">{m.dashboard_empty_title()}</h2>
        <p className="mt-2 max-w-md text-muted-foreground">{m.dashboard_empty_body()}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild className="h-11 rounded-full px-5">
            <Link to="/dashboard/properties/new">
              <Plus />
              {m.dashboard_empty_cta()}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={sample.isPending}
            onClick={() => sample.mutate()}
          >
            {sample.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {m.dashboard_load_sample()}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{m.dashboard_load_sample_hint()}</p>
      </div>
      <ul className="space-y-3">
        {[m.dashboard_empty_step_1(), m.dashboard_empty_step_2(), m.dashboard_empty_step_3()].map(
          (step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-2xl bg-muted/70 p-4 text-sm">
              <span className="figure grid size-7 shrink-0 place-items-center rounded-full bg-card text-xs font-medium">
                {i + 1}
              </span>
              {step}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

/* --------------------------------- Overview -------------------------------- */

function PortfolioOverview({
  properties,
  now,
  metrics,
}: {
  properties: PropertyData[];
  now: Date;
  metrics: ReturnType<typeof portfolioMetrics>;
}) {
  const [range, setRange] = useState<Range>("12");
  const [allocationBy, setAllocationBy] = useState<AllocationBy>("city");
  const currentMonth = toMonthIndex(now);
  const earliest = Math.min(...properties.map((p) => toMonthIndex(p.purchaseDate)));

  const valueSeries = useMemo(() => {
    // Start at the first purchase at the latest, so the chart never shows an empty run-up.
    const start =
      range === "all" ? earliest : Math.max(earliest, currentMonth - (Number(range) - 1));
    return portfolioValueSeries(properties, monthRange(start, currentMonth), currentMonth);
  }, [properties, range, earliest, currentMonth]);

  const flows = useMemo(
    () => cashFlowSeries(properties, monthRange(currentMonth - 11, currentMonth)),
    [properties, currentMonth],
  );
  const last12 = flows.reduce(
    (acc, f) => ({
      income: acc.income + f.income + f.oneOffIncome,
      costs: acc.costs + f.expenses + f.oneOffExpenses + f.mortgagePayment,
      net: acc.net + f.net,
    }),
    { income: 0, costs: 0, net: 0 },
  );

  const allocation = useMemo(() => {
    const groups = new Map<string, number>();
    for (const p of properties) {
      const key = allocationBy === "city" ? p.city : p.type;
      groups.set(key, (groups.get(key) ?? 0) + p.currentValue);
    }
    return [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        key,
        value,
        label: allocationBy === "city" ? key : propertyTypeLabel(key),
      }));
  }, [properties, allocationBy]);

  const yearly = useMemo(() => yearlyValueSeries(properties, now), [properties, now]);

  const thisMonth = useMemo(() => {
    const flows = properties.map((p) => cashFlowForMonth(p, currentMonth));
    return {
      income: flows.reduce((s, f) => s + f.income + f.oneOffIncome, 0),
      operating: flows.reduce((s, f) => s + f.expenses, 0),
      mortgage: flows.reduce((s, f) => s + f.mortgagePayment, 0),
      oneOff: flows.reduce((s, f) => s + f.oneOffExpenses, 0),
      net: flows.reduce((s, f) => s + f.net, 0),
    };
  }, [properties, currentMonth]);

  const movers = useMemo(
    () =>
      properties
        .map((p) => ({ p, metrics: propertyMetrics(p, now) }))
        .sort(
          (a, b) => Math.abs(b.metrics.monthOverMonthPct) - Math.abs(a.metrics.monthOverMonthPct),
        ),
    [properties, now],
  );

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={m.kpi_equity()}
          icon={<Landmark />}
          footer={m.kpi_equity_footer({ debt: formatCurrency(metrics.outstanding) })}
        >
          <Money value={metrics.equity} />
        </StatCard>
        <StatCard
          label={m.kpi_monthly_cash_flow()}
          icon={<Wallet />}
          footer={m.kpi_cash_flow_footer({
            income: formatCurrency(metrics.monthlyIncome),
            costs: formatCurrency(metrics.monthlyExpenses + metrics.monthlyMortgagePayment),
          })}
        >
          <span className={metrics.monthlyCashFlow < 0 ? "text-negative" : undefined}>
            <Money value={metrics.monthlyCashFlow} />
          </span>
        </StatCard>
        <StatCard
          label={m.kpi_net_yield()}
          icon={<Percent />}
          footer={m.kpi_gross_yield_footer({ value: formatPercent(metrics.grossYield) })}
        >
          <span className="figure">{formatPercent(metrics.netYield, { decimals: 2 })}</span>
        </StatCard>
        <StatCard label={m.kpi_payback_date()} icon={<CalendarCheck2 />}>
          <div className="space-y-3">
            <span className="figure block first-letter:uppercase">
              {metrics.payback.month
                ? formatMonth(metrics.payback.month, "long")
                : m.kpi_payback_none()}
            </span>
            <div className="space-y-1.5">
              <Progress value={metrics.payback.progress * 100} className="h-1.5" />
              <p className="text-xs font-normal text-muted-foreground">
                {m.kpi_payback_progress({
                  value: formatPercent(metrics.payback.progress, { decimals: 0 }),
                })}
              </p>
            </div>
          </div>
        </StatCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="surface p-6">
          <SectionHeader
            title={m.dashboard_value_history()}
            description={m.dashboard_value_history_hint()}
            action={
              <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
                <TabsList className="rounded-full">
                  <TabsTrigger value="12" className="rounded-full px-3">
                    {m.range_12m()}
                  </TabsTrigger>
                  <TabsTrigger value="24" className="rounded-full px-3">
                    {m.range_24m()}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="rounded-full px-3">
                    {m.range_all()}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground">{m.kpi_total_invested()}</p>
              <p className="figure mt-1 text-lg font-medium">
                {formatCurrency(metrics.totalInvestment)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{m.kpi_appreciation()}</p>
              <p className="figure mt-1 flex items-center gap-2 text-lg font-medium">
                {formatCurrency(metrics.appreciation, { signed: true })}
                <TrendBadge value={metrics.appreciationPct} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{m.kpi_yoy_growth()}</p>
              <p className="figure mt-1 flex items-center gap-2 text-lg font-medium">
                {formatCurrency(metrics.yoyGrowth, { signed: true })}
                <TrendBadge value={metrics.yoyGrowthPct} />
              </p>
            </div>
          </div>
          {valueSeries.length > 1 ? (
            <PortfolioValueChart data={valueSeries} className="mt-4" />
          ) : (
            <p className="mt-6 rounded-2xl bg-muted/60 px-4 py-10 text-center text-sm text-muted-foreground">
              {m.property_no_history()}
            </p>
          )}
        </div>

        <div className="surface p-6">
          <SectionHeader
            title={m.dashboard_allocation()}
            action={
              <Tabs value={allocationBy} onValueChange={(v) => setAllocationBy(v as AllocationBy)}>
                <TabsList className="rounded-full">
                  <TabsTrigger value="city" className="rounded-full px-3">
                    {m.dashboard_by_city()}
                  </TabsTrigger>
                  <TabsTrigger value="type" className="rounded-full px-3">
                    {m.dashboard_by_type()}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          <AllocationChart
            className="mt-6"
            slices={allocation}
            centerLabel={m.dashboard_total()}
            centerValue={formatCurrency(metrics.totalValue, { compact: true })}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="surface p-6">
          <SectionHeader
            title={m.dashboard_cash_flow_title()}
            description={m.dashboard_cash_flow_hint()}
          />
          <div className="mt-6 grid grid-cols-3 gap-3">
            <MiniStat
              label={m.dashboard_income_12m()}
              value={formatCurrency(last12.income)}
              tone="positive"
            />
            <MiniStat
              label={m.dashboard_costs_12m()}
              value={formatCurrency(-last12.costs)}
              tone="negative"
            />
            <MiniStat
              label={m.dashboard_net_12m()}
              value={formatCurrency(last12.net, { signed: true })}
            />
          </div>
          <CashFlowChart data={flows} className="mt-4" />
        </div>
        <div className="surface flex flex-col p-6">
          <SectionHeader
            title={m.dashboard_this_month()}
            description={formatMonth(flows[flows.length - 1].month, "long")}
          />
          <div className="mt-4 divide-y divide-border/70">
            <KeyValue label={m.chart_rental_income()} value={formatCurrency(thisMonth.income)} />
            <KeyValue
              label={m.chart_operating_costs()}
              value={formatCurrency(-thisMonth.operating)}
            />
            <KeyValue label={m.chart_mortgage()} value={formatCurrency(-thisMonth.mortgage)} />
            <KeyValue
              label={m.chart_one_off_expenses()}
              value={formatCurrency(-thisMonth.oneOff)}
            />
          </div>
          <div className="mt-auto rounded-2xl bg-foreground p-4 text-white">
            <p className="text-xs text-white/60">{m.chart_net_cash_flow()}</p>
            <p className="mt-1 text-2xl font-medium">
              <Money value={thisMonth.net} fractionClassName="opacity-50" />
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="surface p-6">
          <SectionHeader
            title={m.dashboard_yearly_growth()}
            description={m.dashboard_yearly_growth_hint()}
          />
          <YearlyGrowthChart data={yearly} className="mt-4" />
        </div>
        <div className="surface p-6">
          <SectionHeader
            title={m.dashboard_monthly_movers()}
            description={m.dashboard_monthly_movers_hint()}
          />
          <ul className="mt-4 divide-y divide-border/70">
            {movers.slice(0, 5).map(({ p, metrics: pm }) => (
              <li key={p.id}>
                <Link
                  to="/dashboard/properties/$propertyId"
                  params={{ propertyId: p.id }}
                  className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-muted/60"
                >
                  <PropertyTypeIcon type={p.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="figure text-sm font-medium">
                      {formatCurrency(pm.monthOverMonthChange, { signed: true })}
                    </p>
                    <TrendBadge value={pm.monthOverMonthPct} variant="plain" decimals={2} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="surface p-6">
        <SectionHeader
          title={m.dashboard_properties_title()}
          description={m.dashboard_properties_hint()}
          action={
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/dashboard/properties">
                {m.dashboard_view_all()}
                <ArrowRight />
              </Link>
            </Button>
          }
        />
        <PropertiesTable properties={properties} now={now} className="mt-4" />
      </section>
    </>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl bg-muted/60 px-4 py-3">
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        {tone ? (
          <span
            className="size-2 rounded-full"
            style={{ background: tone === "positive" ? "var(--chart-2)" : "var(--chart-1)" }}
          />
        ) : null}
        {label}
      </p>
      <p className="figure mt-1 truncate font-medium sm:text-lg">{value}</p>
    </div>
  );
}
