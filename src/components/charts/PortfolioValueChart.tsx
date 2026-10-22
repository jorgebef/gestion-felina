import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

import { DarkTooltip, TooltipRow, activePoint } from "#/components/charts/ChartTooltip";
import { TrendBadge } from "#/components/finance";
import { ChartContainer, ChartTooltip } from "#/components/ui/chart";
import type { ChartConfig } from "#/components/ui/chart";
import { formatCurrency, formatMonth } from "#/lib/format";
import type { PortfolioValuePoint } from "#/lib/portfolio";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

export function PortfolioValueChart({
  data,
  showInvested = true,
  className,
}: {
  data: PortfolioValuePoint[];
  showInvested?: boolean;
  className?: string;
}) {
  const config = {
    value: { label: m.chart_market_value(), color: "var(--chart-1)" },
    invested: { label: m.chart_total_invested(), color: "var(--muted-foreground)" },
  } satisfies ChartConfig;

  const values = data.map((d) => d.value).filter((v) => v > 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const padding = Math.max((max - min) * 0.25, max * 0.02);

  return (
    <ChartContainer config={config} className={cn("aspect-auto h-72 w-full", className)}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 6" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
          tickFormatter={(v: string) => formatMonth(v)}
        />
        <YAxis
          width={64}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          domain={[Math.max(0, min - padding), max + padding]}
          tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }}
          content={(props) => {
            const point = activePoint<PortfolioValuePoint>(props);
            if (!point) return null;
            const index = data.findIndex((d) => d.month === point.month);
            const previous = index > 0 ? data[index - 1].value : 0;
            return (
              <DarkTooltip title={formatMonth(point.month, "long")}>
                <div className="flex items-center gap-2">
                  <span className="figure text-base font-medium">
                    {formatCurrency(point.value)}
                  </span>
                  {previous > 0 ? (
                    <TrendBadge
                      value={(point.value - previous) / previous}
                      variant="glass"
                      decimals={2}
                    />
                  ) : null}
                </div>
                {showInvested ? (
                  <div className="mt-1.5 border-t border-white/10 pt-1.5">
                    <TooltipRow
                      label={m.chart_total_invested()}
                      value={formatCurrency(point.invested)}
                    />
                  </div>
                ) : null}
              </DarkTooltip>
            );
          }}
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2.2}
          fill="url(#portfolio-fill)"
          activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }}
        />
        {showInvested ? (
          <Line
            dataKey="invested"
            type="stepAfter"
            stroke="var(--color-invested)"
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            strokeWidth={1.4}
            dot={false}
            activeDot={false}
          />
        ) : null}
      </AreaChart>
    </ChartContainer>
  );
}
