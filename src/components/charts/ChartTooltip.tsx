import type { ReactNode } from "react";

import { cn } from "#/lib/utils";

interface TooltipState {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

/** Returns the data row under the cursor, or null when the tooltip is hidden. */
export function activePoint<T>(props: TooltipState): T | null {
  if (!props.active || !props.payload?.length) return null;
  return (props.payload[0].payload as T | undefined) ?? null;
}

/** Dark floating bubble used by every chart, echoing banking app tooltips. */
export function DarkTooltip({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-36 rounded-2xl bg-foreground px-3.5 py-2.5 text-xs text-white shadow-xl shadow-black/20",
        className,
      )}
    >
      {title ? <div className="mb-1.5 text-[11px] text-white/55">{title}</div> : null}
      {children}
    </div>
  );
}

export function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-white/70">
        {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null}
        {label}
      </span>
      <span className="figure font-medium text-white">{value}</span>
    </div>
  );
}
