import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BedDouble,
  CalendarCheck2,
  LineChart,
  MapPin,
  Pencil,
  Percent,
  Plus,
  Ruler,
  Trash2,
  Wallet,
  Landmark,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AllocationChart } from "#/components/charts/AllocationChart";
import { CashFlowChart } from "#/components/charts/CashFlowChart";
import { ValuationChangeChart } from "#/components/charts/GrowthCharts";
import { PortfolioValueChart } from "#/components/charts/PortfolioValueChart";
import { KeyValue, Money, SectionHeader, StatCard, TrendBadge } from "#/components/finance";
import {
  OneOffItemDialog,
  RecurringItemDialog,
  ValuationDialog,
} from "#/components/properties/ItemDialogs";
import { PropertyTypeIcon } from "#/components/properties/PropertyTypeIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { formatCurrency, formatDate, formatMonth, formatNumber, formatPercent } from "#/lib/format";
import { categoryLabel, frequencyLabel, propertyTypeLabel } from "#/lib/labels";
import {
  cashFlowSeries,
  monthKey,
  monthRange,
  monthlyEquivalent,
  mortgageForMonth,
  portfolioValueSeries,
  propertyMetrics,
  toMonthIndex,
  valuationHistory,
} from "#/lib/portfolio";
import type { RecurringItemData } from "#/lib/portfolio";
import { propertyQuery } from "#/lib/queries";
import type { RecurringItemInput } from "#/lib/schemas";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import {
  addOneOffItem,
  addRecurringItem,
  addValuation,
  deleteOneOffItem,
  deleteProperty,
  deleteRecurringItem,
  deleteValuation,
  updateRecurringItem,
} from "#/server/properties";
import type { PropertyWithItems } from "#/server/properties";

export const Route = createFileRoute("/dashboard/properties/$propertyId/")({
  loader: async ({ context, params }) => {
    const property = await context.queryClient.ensureQueryData(propertyQuery(params.propertyId));
    if (!property) throw notFound();
    return { name: property.name };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} · SpainFolio` : "SpainFolio" }],
  }),
  component: PropertyPage,
  notFoundComponent: PropertyNotFound,
});

type Range = "12" | "24" | "all";

function useInvalidateProperties() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["properties"] });
}

function PropertyPage() {
  const { propertyId } = Route.useParams();
  const { data: property } = useSuspenseQuery(propertyQuery(propertyId));
  if (!property) return <PropertyNotFound />;
  return <PropertyDetail property={property} />;
}

function PropertyDetail({ property: p }: { property: PropertyWithItems }) {
  const now = useMemo(() => new Date(), []);
  const currentMonth = toMonthIndex(now);
  const purchaseMonth = toMonthIndex(p.purchaseDate);
  const metrics = useMemo(() => propertyMetrics(p, now), [p, now]);
  const [range, setRange] = useState<Range>("12");
  const [valuationOpen, setValuationOpen] = useState(false);
  const invalidate = useInvalidateProperties();

  const valueSeries = useMemo(() => {
    // Never chart months before the property was bought.
    const start =
      range === "all" ? purchaseMonth : Math.max(purchaseMonth, currentMonth - (Number(range) - 1));
    return portfolioValueSeries([p], monthRange(start, currentMonth), currentMonth);
  }, [p, range, purchaseMonth, currentMonth]);

  const valuationMonths = useMemo(
    () =>
      valuationHistory(
        p,
        monthRange(Math.max(purchaseMonth + 1, currentMonth - 11), currentMonth),
        currentMonth,
      ),
    [p, purchaseMonth, currentMonth],
  );

  const flows = useMemo(
    () => cashFlowSeries([p], monthRange(Math.max(purchaseMonth, currentMonth - 11), currentMonth)),
    [p, purchaseMonth, currentMonth],
  );

  const recordValuation = async (valuation: { date: string; value: number }) => {
    try {
      await addValuation({ data: { propertyId: p.id, valuation } });
      await invalidate();
      setValuationOpen(false);
      toast.success(m.toast_valuation_saved());
    } catch {
      toast.error(m.error_generic());
    }
  };

  return (
    <main className="page-container space-y-5 pt-4">
      <Link
        to="/dashboard/properties"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {m.app_nav_properties()}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <PropertyTypeIcon type={p.type} className="size-14 rounded-[1.1rem] [&_svg]:size-6" />
          <div>
            <h1 className="text-3xl font-medium tracking-tight">{p.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {p.address}, {p.postalCode ? `${p.postalCode} ` : ""}
              {p.city} ({p.province})
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="rounded-full">
                {propertyTypeLabel(p.type)}
              </Badge>
              {p.sizeSqm ? (
                <Badge variant="secondary" className="gap-1 rounded-full">
                  <Ruler className="size-3" />
                  {formatNumber(p.sizeSqm)} m²
                </Badge>
              ) : null}
              {p.bedrooms ? (
                <Badge variant="secondary" className="gap-1 rounded-full">
                  <BedDouble className="size-3" />
                  {p.bedrooms}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="rounded-full">
                {m.property_bought_on({ date: formatDate(p.purchaseDate) })}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => setValuationOpen(true)}
          >
            <LineChart />
            {m.property_record_valuation()}
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-card">
            <Link to="/dashboard/properties/$propertyId/edit" params={{ propertyId: p.id }}>
              <Pencil />
              {m.action_edit()}
            </Link>
          </Button>
          <DeletePropertyButton id={p.id} name={p.name} />
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="surface p-6">
          <SectionHeader
            title={m.kpi_current_value()}
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
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="text-[40px] leading-none font-medium">
              <Money value={p.currentValue} />
            </p>
            <div className="flex flex-wrap items-center gap-2 pb-1 text-xs text-muted-foreground">
              <TrendBadge value={metrics.appreciationPct} />
              {m.property_since_purchase({
                amount: formatCurrency(metrics.appreciation, { signed: true }),
              })}
              <span className="text-border">|</span>
              <TrendBadge value={metrics.monthOverMonthPct} decimals={2} />
              {m.dashboard_mom_label()}
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <StatCard
            label={m.kpi_monthly_cash_flow()}
            icon={<Wallet />}
            footer={m.property_cash_flow_footer({
              noi: formatCurrency(metrics.monthlyNoi),
              mortgage: formatCurrency(metrics.monthlyMortgagePayment),
            })}
          >
            <span className={metrics.monthlyCashFlow < 0 ? "text-negative" : undefined}>
              <Money value={metrics.monthlyCashFlow} />
            </span>
          </StatCard>
          <StatCard
            label={m.kpi_net_yield()}
            icon={<Percent />}
            footer={m.property_yield_footer({
              gross: formatPercent(metrics.grossYield),
              coc: formatPercent(metrics.cashOnCash),
            })}
          >
            <span className="figure">{formatPercent(metrics.netYield, { decimals: 2 })}</span>
          </StatCard>
          <StatCard
            label={m.kpi_payback_date()}
            icon={<CalendarCheck2 />}
            className="sm:col-span-2 xl:col-span-1"
          >
            <div className="space-y-3">
              <span className="figure block first-letter:uppercase">
                {metrics.payback.month
                  ? formatMonth(metrics.payback.month, "long")
                  : m.kpi_payback_none()}
              </span>
              <Progress value={metrics.payback.progress * 100} className="h-1.5" />
              <p className="text-xs font-normal text-muted-foreground">
                {m.property_payback_detail({
                  recovered: formatCurrency(Math.max(0, metrics.cumulativeProfit)),
                  total: formatCurrency(metrics.totalInvestment),
                })}
              </p>
            </div>
          </StatCard>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="surface p-6">
          <SectionHeader
            title={m.property_monthly_valuation()}
            description={m.property_monthly_valuation_hint()}
          />
          {valuationMonths.length ? (
            <ValuationChangeChart data={valuationMonths} className="mt-4" />
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">{m.property_no_history()}</p>
          )}
        </div>
        <ValuationLog
          property={p}
          history={valuationMonths}
          onRecord={() => setValuationOpen(true)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="surface p-6">
          <SectionHeader
            title={m.dashboard_cash_flow_title()}
            description={m.property_cash_flow_hint()}
          />
          <CashFlowChart data={flows} className="mt-4" />
        </div>
        <div className="surface p-6">
          <SectionHeader title={m.property_acquisition_title()} />
          <AllocationChart
            className="mt-4"
            centerLabel={m.opportunity_total_investment()}
            centerValue={formatCurrency(metrics.totalInvestment, { compact: true })}
            slices={[
              { key: "price", label: m.form_purchase_price(), value: p.purchasePrice },
              { key: "tax", label: m.form_transfer_tax(), value: p.transferTax },
              { key: "notary", label: m.form_notary_fees(), value: p.notaryFees },
              { key: "agency", label: m.form_agency_fees(), value: p.agencyFees },
              { key: "renovation", label: m.form_renovation_costs(), value: p.renovationCosts },
            ].filter((s) => s.value > 0)}
          />
        </div>
      </section>

      <MortgageCard property={p} now={now} equity={metrics.equity} />

      <RecurringItemsCard property={p} />
      <OneOffItemsCard property={p} />

      <ValuationDialog
        open={valuationOpen}
        onOpenChange={setValuationOpen}
        currentValue={p.currentValue}
        onSubmit={recordValuation}
      />
    </main>
  );
}

/* --------------------------------- Valuations -------------------------------- */

function ValuationLog({
  property: p,
  history,
  onRecord,
}: {
  property: PropertyWithItems;
  history: ReturnType<typeof valuationHistory>;
  onRecord: () => void;
}) {
  const invalidate = useInvalidateProperties();
  const recorded = new Map(p.valuations.map((v) => [v.date.slice(0, 7), v]));
  const remove = useMutation({
    mutationFn: (id: string) => deleteValuation({ data: { propertyId: p.id, id } }),
    onSuccess: () => invalidate(),
    onError: () => toast.error(m.error_generic()),
  });

  return (
    <div className="surface flex flex-col p-6">
      <SectionHeader
        title={m.property_valuation_log()}
        description={m.property_valuation_log_hint()}
        action={
          <Button size="sm" variant="outline" className="rounded-full" onClick={onRecord}>
            <Plus />
            {m.action_add()}
          </Button>
        }
      />
      <div className="mt-4 max-h-72 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-normal text-muted-foreground">
                {m.table_month()}
              </TableHead>
              <TableHead className="text-right text-xs font-normal text-muted-foreground">
                {m.table_value()}
              </TableHead>
              <TableHead className="text-right text-xs font-normal text-muted-foreground">
                {m.table_change()}
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...history].reverse().map((row) => {
              const entry = recorded.get(row.month);
              return (
                <TableRow key={row.month} className="border-border/60">
                  <TableCell className="first-letter:uppercase">
                    <span className="flex items-center gap-2">
                      {formatMonth(row.month, "long")}
                      {!entry && row.month !== monthKey(toMonthIndex(new Date())) ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                              {m.property_estimated_short()}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{m.property_estimated_tooltip()}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="figure text-right">{formatCurrency(row.value)}</TableCell>
                  <TableCell className="text-right">
                    <TrendBadge
                      value={row.changePct}
                      variant="plain"
                      decimals={2}
                      className="justify-end"
                    />
                  </TableCell>
                  <TableCell>
                    {entry ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground hover:text-negative"
                        aria-label={m.action_remove()}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(entry.id)}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* --------------------------------- Mortgage -------------------------------- */

function MortgageCard({
  property: p,
  now,
  equity,
}: {
  property: PropertyWithItems;
  now: Date;
  equity: number;
}) {
  if (!p.hasMortgage) {
    return (
      <section className="surface flex flex-wrap items-center gap-4 p-6">
        <span className="grid size-11 place-items-center rounded-2xl bg-positive-soft text-positive">
          <Landmark className="size-5" />
        </span>
        <div>
          <h2 className="font-medium">{m.property_no_mortgage_title()}</h2>
          <p className="text-sm text-muted-foreground">{m.property_no_mortgage_body()}</p>
        </div>
        <p className="figure ml-auto text-2xl font-medium">{formatCurrency(equity)}</p>
      </section>
    );
  }

  const outstanding = Math.max(0, p.mortgagePrincipal - p.mortgagePaidOff);
  const progress = p.mortgagePrincipal ? p.mortgagePaidOff / p.mortgagePrincipal : 0;
  const thisMonth = mortgageForMonth(p, toMonthIndex(now));
  const start = toMonthIndex(p.mortgageStartDate ?? p.purchaseDate);
  const end = monthKey(start + Math.round(p.mortgageTermYears * 12) - 1);

  return (
    <section className="surface grid gap-8 p-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <SectionHeader
          title={m.property_mortgage_title()}
          description={m.property_mortgage_hint()}
        />
        <div className="mt-6">
          <p className="text-xs text-muted-foreground">{m.property_outstanding()}</p>
          <p className="mt-1 text-3xl font-medium">
            <Money value={outstanding} />
          </p>
          <Progress value={progress * 100} className="mt-4 h-2" />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              {m.property_paid_off_share({ value: formatPercent(progress, { decimals: 0 }) })}
            </span>
            <span className="first-letter:uppercase">
              {m.property_mortgage_ends({ date: formatMonth(end, "long") })}
            </span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-xs text-muted-foreground">{m.property_interest_this_month()}</p>
            <p className="figure mt-1 text-lg font-medium text-negative">
              {formatCurrency(thisMonth.interest)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="text-xs text-muted-foreground">{m.property_principal_this_month()}</p>
            <p className="figure mt-1 text-lg font-medium text-positive">
              {formatCurrency(Math.max(0, thisMonth.payment - thisMonth.interest))}
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-border/70 self-start">
        <KeyValue label={m.form_mortgage_principal()} value={formatCurrency(p.mortgagePrincipal)} />
        <KeyValue
          label={m.form_mortgage_rate()}
          value={formatPercent(p.mortgageInterestRate / 100, { decimals: 2 })}
        />
        <KeyValue
          label={m.form_mortgage_term()}
          value={m.opportunity_years({ years: String(p.mortgageTermYears) })}
        />
        <KeyValue
          label={m.form_mortgage_start()}
          value={formatDate(p.mortgageStartDate ?? p.purchaseDate)}
        />
        <KeyValue
          label={m.form_summary_mortgage_payment()}
          value={formatCurrency(thisMonth.payment || 0)}
        />
        <KeyValue label={m.form_mortgage_paid_off()} value={formatCurrency(p.mortgagePaidOff)} />
        <KeyValue label={m.kpi_equity()} value={formatCurrency(equity)} />
      </div>
    </section>
  );
}

/* ------------------------------ Recurring items ----------------------------- */

function RecurringItemsCard({ property: p }: { property: PropertyWithItems }) {
  const invalidate = useInvalidateProperties();
  const [dialog, setDialog] = useState<
    { mode: "add"; kind: "income" | "expense" } | { mode: "edit"; item: RecurringItemData } | null
  >(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecurringItem({ data: { propertyId: p.id, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success(m.toast_item_removed());
    },
    onError: () => toast.error(m.error_generic()),
  });

  const save = async (item: RecurringItemInput) => {
    try {
      if (dialog?.mode === "edit") {
        await updateRecurringItem({ data: { propertyId: p.id, id: dialog.item.id, item } });
      } else {
        await addRecurringItem({ data: { propertyId: p.id, item } });
      }
      await invalidate();
      setDialog(null);
      toast.success(m.toast_item_saved());
    } catch {
      toast.error(m.error_generic());
    }
  };

  const income = p.recurringItems.filter((i) => i.kind === "income");
  const expenses = p.recurringItems.filter((i) => i.kind === "expense");
  const monthlyTotal = (items: RecurringItemData[]) =>
    items.reduce(
      (s, i) =>
        s +
        (i.endDate && i.endDate < new Date().toISOString().slice(0, 10) ? 0 : monthlyEquivalent(i)),
      0,
    );

  return (
    <section className="surface p-6">
      <SectionHeader
        title={m.property_recurring_title()}
        description={m.property_recurring_hint({
          income: formatCurrency(monthlyTotal(income)),
          expenses: formatCurrency(monthlyTotal(expenses)),
        })}
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setDialog({ mode: "add", kind: "income" })}
            >
              <Plus />
              {m.form_add_income()}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setDialog({ mode: "add", kind: "expense" })}
            >
              <Plus />
              {m.form_add_expense()}
            </Button>
          </>
        }
      />
      {p.recurringItems.length ? (
        <div className="mt-4 overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-normal text-muted-foreground">
                  {m.table_item()}
                </TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">
                  {m.form_frequency()}
                </TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">
                  {m.table_period()}
                </TableHead>
                <TableHead className="text-right text-xs font-normal text-muted-foreground">
                  {m.form_amount()}
                </TableHead>
                <TableHead className="text-right text-xs font-normal text-muted-foreground">
                  {m.table_per_month()}
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...income, ...expenses].map((item) => (
                <TableRow key={item.id} className="border-border/60">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <KindDot kind={item.kind} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.label}</p>
                        {item.label !== categoryLabel(item.category) ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {categoryLabel(item.category)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {frequencyLabel(item.frequency)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(item.startDate)} →{" "}
                    {item.endDate ? formatDate(item.endDate) : m.table_ongoing()}
                  </TableCell>
                  <TableCell className="figure text-right">
                    {formatCurrency(item.amount, { decimals: 2 })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "figure text-right font-medium",
                      item.kind === "income" ? "text-positive" : "text-negative",
                    )}
                  >
                    {formatCurrency(
                      item.kind === "income" ? monthlyEquivalent(item) : -monthlyEquivalent(item),
                      {
                        decimals: 2,
                        signed: true,
                      },
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground"
                        aria-label={m.action_edit()}
                        onClick={() => setDialog({ mode: "edit", item })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground hover:text-negative"
                        aria-label={m.action_remove()}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
          {m.property_recurring_empty()}
        </p>
      )}
      <RecurringItemDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        initial={dialog?.mode === "edit" ? dialog.item : undefined}
        defaultKind={dialog?.mode === "add" ? dialog.kind : "income"}
        defaultStartDate={p.purchaseDate}
        onSubmit={save}
      />
    </section>
  );
}

/* ------------------------------- One-off items ------------------------------ */

function OneOffItemsCard({ property: p }: { property: PropertyWithItems }) {
  const invalidate = useInvalidateProperties();
  const [dialogKind, setDialogKind] = useState<"income" | "expense" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteOneOffItem({ data: { propertyId: p.id, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success(m.toast_item_removed());
    },
    onError: () => toast.error(m.error_generic()),
  });

  const totals = p.oneOffItems.reduce(
    (acc, i) => {
      if (i.kind === "income") acc.income += i.amount;
      else acc.expenses += i.amount;
      return acc;
    },
    { income: 0, expenses: 0 },
  );

  return (
    <section className="surface p-6">
      <SectionHeader
        title={m.property_one_off_title()}
        description={m.property_one_off_hint({
          income: formatCurrency(totals.income),
          expenses: formatCurrency(totals.expenses),
        })}
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setDialogKind("income")}
            >
              <Plus />
              {m.property_one_off_add_income()}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setDialogKind("expense")}
            >
              <Plus />
              {m.property_one_off_add_expense()}
            </Button>
          </>
        }
      />
      {p.oneOffItems.length ? (
        <div className="mt-4 overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-normal text-muted-foreground">
                  {m.form_date()}
                </TableHead>
                <TableHead className="text-xs font-normal text-muted-foreground">
                  {m.table_item()}
                </TableHead>
                <TableHead className="text-right text-xs font-normal text-muted-foreground">
                  {m.form_amount()}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.oneOffItems.map((item) => (
                <TableRow key={item.id} className="border-border/60">
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(item.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <KindDot kind={item.kind} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.label}</p>
                        {item.label !== categoryLabel(item.category) ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {categoryLabel(item.category)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "figure text-right font-medium",
                      item.kind === "income" ? "text-positive" : "text-negative",
                    )}
                  >
                    {formatCurrency(item.kind === "income" ? item.amount : -item.amount, {
                      decimals: 2,
                      signed: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full text-muted-foreground hover:text-negative"
                      aria-label={m.action_remove()}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(item.id)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
          {m.property_one_off_empty()}
        </p>
      )}
      <OneOffItemDialog
        open={dialogKind !== null}
        onOpenChange={(open) => !open && setDialogKind(null)}
        defaultKind={dialogKind ?? "expense"}
        onSubmit={async (item) => {
          try {
            await addOneOffItem({ data: { propertyId: p.id, item } });
            await invalidate();
            setDialogKind(null);
            toast.success(m.toast_item_saved());
          } catch {
            toast.error(m.error_generic());
          }
        }}
      />
    </section>
  );
}

function KindDot({ kind }: { kind: "income" | "expense" }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-medium",
        kind === "income" ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative",
      )}
      aria-label={kind === "income" ? m.kind_income() : m.kind_expense()}
    >
      {kind === "income" ? "+" : "−"}
    </span>
  );
}

/* ---------------------------------- Delete --------------------------------- */

function DeletePropertyButton({ id, name }: { id: string; name: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteProperty({ data: { id } }),
    onSuccess: async () => {
      await navigate({ to: "/dashboard/properties" });
      queryClient.removeQueries({ queryKey: ["properties", id] });
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success(m.toast_property_deleted());
    },
    onError: () => toast.error(m.error_generic()),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-negative"
          aria-label={m.action_delete()}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{m.property_delete_title({ name })}</AlertDialogTitle>
          <AlertDialogDescription>{m.property_delete_body()}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{m.action_cancel()}</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            onClick={() => remove.mutate()}
          >
            {m.action_delete()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PropertyNotFound() {
  return (
    <main className="page-container grid place-items-center py-24 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-medium">{m.property_not_found()}</h1>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/dashboard/properties">{m.app_nav_properties()}</Link>
        </Button>
      </div>
    </main>
  );
}
