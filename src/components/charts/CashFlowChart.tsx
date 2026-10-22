import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { DarkTooltip, TooltipRow, activePoint } from "#/components/charts/ChartTooltip";
import { ChartContainer, ChartTooltip } from "#/components/ui/chart";
import type { ChartConfig } from "#/components/ui/chart";
import { formatCurrency, formatMonth } from "#/lib/format";
import type { CashFlowPoint } from "#/lib/portfolio";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

interface Row {
  month: string;
  income: number;
  expenses: number;
  net: number;
  source: CashFlowPoint;
}

/** Income above the axis, costs (incl. mortgage and one-offs) below, net cash flow as a line. */
export function CashFlowChart({ data, className }: { data: CashFlowPoint[]; className?: string }) {
  const config = {
    income: { label: m.chart_income(), color: "var(--chart-2)" },
    expenses: { label: m.chart_expenses(), color: "var(--chart-1)" },
    net: { label: m.chart_net_cash_flow(), color: "var(--foreground)" },
  } satisfies ChartConfig;

  const rows: Row[] = data.map((d) => ({
    month: d.month,
    income: d.income + d.oneOffIncome,
    expenses: -(d.expenses + d.oneOffExpenses + d.mortgagePayment),
    net: d.net,
    source: d,
  }));

  return (
    <ChartContainer config={config} className={cn("aspect-auto h-72 w-full", className)}>
      <ComposedChart
        data={rows}
        margin={{ left: 4, right: 8, top: 12, bottom: 0 }}
        stackOffset="sign"
      >
        <CartesianGrid vertical={false} strokeDasharray="3 6" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={16}
          tickFormatter={(v: string) => formatMonth(v)}
        />
        <YAxis
          width={64}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={(props) => {
            const row = activePoint<Row>(props);
            if (!row) return null;
            const { source } = row;
            return (
              <DarkTooltip title={formatMonth(source.month, "long")} className="min-w-52">
                <TooltipRow
                  color="var(--chart-2)"
                  label={m.chart_rental_income()}
                  value={formatCurrency(source.income)}
                />
                {source.oneOffIncome ? (
                  <TooltipRow
                    color="var(--chart-2)"
                    label={m.chart_one_off_income()}
                    value={formatCurrency(source.oneOffIncome)}
                  />
                ) : null}
                <TooltipRow
                  color="var(--chart-1)"
                  label={m.chart_operating_costs()}
                  value={formatCurrency(-source.expenses)}
                />
                {source.mortgagePayment ? (
                  <TooltipRow
                    color="var(--chart-1)"
                    label={m.chart_mortgage()}
                    value={formatCurrency(-source.mortgagePayment)}
                  />
                ) : null}
                {source.oneOffExpenses ? (
                  <TooltipRow
                    color="var(--chart-1)"
                    label={m.chart_one_off_expenses()}
                    value={formatCurrency(-source.oneOffExpenses)}
                  />
                ) : null}
                <div className="mt-1.5 border-t border-white/10 pt-1.5">
                  <TooltipRow
                    label={m.chart_net_cash_flow()}
                    value={formatCurrency(source.net, { signed: true })}
                  />
                </div>
              </DarkTooltip>
            );
          }}
        />
        <Bar
          dataKey="income"
          stackId="flow"
          fill="var(--color-income)"
          radius={[6, 6, 0, 0]}
          maxBarSize={22}
        />
        <Bar
          dataKey="expenses"
          stackId="flow"
          fill="var(--color-expenses)"
          radius={[6, 6, 0, 0]}
          maxBarSize={22}
          fillOpacity={0.85}
        />
        <Line
          dataKey="net"
          type="monotone"
          stroke="var(--color-net)"
          strokeWidth={1.8}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

/** Thin vertical bars, highlighted around the hovered month (inspired by banking overviews). */
export function MiniBars({
  values,
  highlightLast = 3,
  className,
  tone = "dark",
}: {
  values: number[];
  highlightLast?: number;
  className?: string;
  tone?: "dark" | "brand";
}) {
  const data = values.map((value, index) => ({ index, value }));
  const positive = values.filter((v) => v > 0);
  const max = Math.max(...positive, 1);
  // Start the axis just below the smallest value so month-to-month movement is visible.
  const min = positive.length ? Math.min(...positive) : 0;
  const floor = Math.max(0, min - (max - min) * 0.35);
  return (
    <ChartContainer
      config={{ value: { label: "" } }}
      className={cn("aspect-auto h-24 w-full", className)}
    >
      <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barCategoryGap={1}>
        <YAxis hide domain={[floor, max]} allowDataOverflow />
        <Bar
          dataKey="value"
          radius={[3, 3, 3, 3]}
          maxBarSize={4}
          shape={(props: {
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            index?: number;
          }) => {
            const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
            const active = index >= data.length - highlightLast;
            if (height <= 0) return <g />;
            return (
              <rect
                x={x + width / 2 - 1.25}
                y={y}
                width={2.5}
                height={height}
                rx={1.25}
                fill={
                  active
                    ? tone === "brand"
                      ? "var(--brand)"
                      : "var(--foreground)"
                    : "var(--border)"
                }
              />
            );
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}
