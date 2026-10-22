import { Cell, Pie, PieChart } from "recharts";

import { DarkTooltip, TooltipRow, activePoint } from "#/components/charts/ChartTooltip";
import { ChartContainer, ChartTooltip } from "#/components/ui/chart";
import { formatCurrency, formatPercent } from "#/lib/format";
import { cn } from "#/lib/utils";

export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export interface AllocationSlice {
  key: string;
  label: string;
  value: number;
}

/** Donut with the total in the middle and a progress-bar legend underneath. */
export function AllocationChart({
  slices,
  centerLabel,
  centerValue,
  className,
}: {
  slices: AllocationSlice[];
  centerLabel: string;
  centerValue: string;
  className?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const colored = slices.map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="relative">
        <ChartContainer config={{}} className="mx-auto aspect-square h-52">
          <PieChart>
            <ChartTooltip
              content={(props) => {
                const slice = activePoint<(typeof colored)[number]>(props);
                if (!slice) return null;
                return (
                  <DarkTooltip>
                    <TooltipRow
                      color={slice.color}
                      label={slice.label}
                      value={formatCurrency(slice.value)}
                    />
                    <TooltipRow label="%" value={formatPercent(total ? slice.value / total : 0)} />
                  </DarkTooltip>
                );
              }}
            />
            <Pie
              data={colored}
              dataKey="value"
              nameKey="label"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={2.5}
              cornerRadius={6}
              strokeWidth={0}
            >
              {colored.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
          <span className="figure text-xl font-medium">{centerValue}</span>
        </div>
      </div>
      <ul className="space-y-3">
        {colored.map((s) => {
          const share = total ? s.value / total : 0;
          return (
            <li key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="figure shrink-0 text-muted-foreground">
                  {formatCurrency(s.value, { compact: true })} ·{" "}
                  {formatPercent(share, { decimals: 0 })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share * 100}%`, background: s.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
