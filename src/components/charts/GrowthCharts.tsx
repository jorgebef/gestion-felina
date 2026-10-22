import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { DarkTooltip, TooltipRow, activePoint } from "#/components/charts/ChartTooltip";
import { ChartContainer, ChartTooltip } from "#/components/ui/chart";
import { formatCurrency, formatMonth, formatPercent } from "#/lib/format";
import type { ValuationPoint, YearlyValuePoint } from "#/lib/portfolio";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

/** Portfolio value at each year end with the year-over-year change printed on the bar. */
export function YearlyGrowthChart({
  data,
  className,
}: {
  data: YearlyValuePoint[];
  className?: string;
}) {
  return (
    <ChartContainer
      config={{ value: { label: m.chart_market_value(), color: "var(--chart-2)" } }}
      className={cn("aspect-auto h-64 w-full", className)}
    >
      <BarChart data={data} margin={{ left: 4, right: 8, top: 28, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 6" />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis
          width={64}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={(props) => {
            const point = activePoint<YearlyValuePoint>(props);
            if (!point) return null;
            return (
              <DarkTooltip title={String(point.year)}>
                <TooltipRow label={m.chart_market_value()} value={formatCurrency(point.value)} />
                {point.growthPct !== null ? (
                  <TooltipRow
                    label={m.chart_yoy_growth()}
                    value={formatPercent(point.growthPct, { signed: true })}
                  />
                ) : null}
              </DarkTooltip>
            );
          }}
        />
        <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={56}>
          {data.map((d, i) => (
            <Cell
              key={d.year}
              fill={i === data.length - 1 ? "var(--foreground)" : "var(--color-value)"}
              fillOpacity={i === data.length - 1 ? 1 : 0.85}
            />
          ))}
          <LabelList
            dataKey="growthPct"
            position="top"
            offset={8}
            className="fill-muted-foreground text-[11px]"
            formatter={(v: unknown) =>
              typeof v === "number" ? formatPercent(v, { signed: true }) : ""
            }
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Month-over-month change in valuation; gains in green, drops in terracotta. */
export function ValuationChangeChart({
  data,
  className,
}: {
  data: ValuationPoint[];
  className?: string;
}) {
  return (
    <ChartContainer
      config={{ change: { label: m.chart_monthly_change() } }}
      className={cn("aspect-auto h-56 w-full", className)}
    >
      <BarChart data={data} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
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
            const point = activePoint<ValuationPoint>(props);
            if (!point) return null;
            return (
              <DarkTooltip title={formatMonth(point.month, "long")}>
                <TooltipRow label={m.chart_value()} value={formatCurrency(point.value)} />
                <TooltipRow
                  label={m.chart_monthly_change()}
                  value={`${formatCurrency(point.change, { signed: true })} · ${formatPercent(point.changePct, { signed: true, decimals: 2 })}`}
                />
              </DarkTooltip>
            );
          }}
        />
        <Bar dataKey="change" radius={[6, 6, 6, 6]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.month} fill={d.change >= 0 ? "var(--chart-2)" : "var(--chart-1)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
