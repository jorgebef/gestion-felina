import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { formatPercent, splitCurrency } from "#/lib/format";
import { cn } from "#/lib/utils";

/** A large euro figure with the cents dimmed, as in banking apps. */
export function Money({
  value,
  className,
  fractionClassName,
}: {
  value: number;
  className?: string;
  fractionClassName?: string;
}) {
  const { whole, fraction, suffix } = splitCurrency(value);
  return (
    <span className={cn("figure", className)}>
      {whole}
      <span className={cn("opacity-45", fractionClassName)}>{fraction}</span>
      {suffix}
    </span>
  );
}

export function TrendBadge({
  value,
  className,
  variant = "soft",
  decimals = 1,
}: {
  value: number;
  className?: string;
  variant?: "soft" | "solid" | "plain" | "glass";
  decimals?: number;
}) {
  const positive = value > 0.00005;
  const negative = value < -0.00005;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "figure inline-flex items-center gap-0.5 rounded-full text-xs font-medium whitespace-nowrap",
        variant !== "plain" && "px-2 py-0.5",
        variant === "soft" &&
          (positive
            ? "bg-positive-soft text-positive"
            : negative
              ? "bg-negative-soft text-negative"
              : "bg-muted text-muted-foreground"),
        variant === "plain" &&
          (positive ? "text-positive" : negative ? "text-negative" : "text-muted-foreground"),
        variant === "solid" && "bg-foreground text-white",
        variant === "glass" && "bg-white/15 text-white backdrop-blur",
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.2} />
      {formatPercent(Math.abs(value), { decimals })}
    </span>
  );
}

export function StatCard({
  label,
  icon,
  children,
  footer,
  className,
}: {
  label: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface flex flex-col gap-4 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-foreground/70 [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="text-[26px] leading-none font-medium tracking-tight">{children}</div>
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function KeyValue({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="figure text-right font-medium">{value}</span>
    </div>
  );
}
