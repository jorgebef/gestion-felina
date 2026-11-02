/**
 * Placeholders for result lists while their query is fetching (first load, a filter
 * change, an invalidation after a mutation or a background refetch). Lists show these
 * instead of the previous results, so stale data is never presented as current.
 */
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Announces the loading to assistive technology; the shapes themselves are hidden. */
function Busy({
  label = "Cargando resultados…",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

const widths = ["w-2/5", "w-1/2", "w-1/3", "w-3/5", "w-2/5", "w-1/2"];

function RowLines({ index, badges }: { index: number; badges: boolean }) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className={cn("h-4", widths[index % widths.length])} />
      <Skeleton className="h-3 w-3/4 max-w-sm" />
      {badges ? (
        <div className="flex gap-1.5 pt-0.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A divided list of rows (actions, organizations, members, sessions…).
 * `framed` draws the card around it, like `<ul className="surface divide-y">`.
 */
export function RowsSkeleton({
  rows = 5,
  framed = true,
  badges = false,
  trailing = false,
  icon = false,
  label,
  className,
}: {
  rows?: number;
  framed?: boolean;
  /** A line of status pills under each row, as in action rows. */
  badges?: boolean;
  /** A control on the right of each row (button, select). */
  trailing?: boolean;
  /** An icon on the left of each row. */
  icon?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <Busy label={label} className={cn(framed && "surface", "divide-y", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {icon ? <Skeleton className="size-5 shrink-0 rounded-full" /> : null}
          <RowLines index={i} badges={badges} />
          {trailing ? <Skeleton className="h-8 w-24 shrink-0" /> : null}
        </div>
      ))}
    </Busy>
  );
}

/** Cards laid out like the colony grid (or stacked, like proposal cards). */
export function CardsSkeleton({
  cards = 4,
  className = "grid gap-3 md:grid-cols-2",
  label,
}: {
  cards?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Busy label={label} className={className}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="surface space-y-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className={cn("h-4", widths[i % widths.length])} />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </Busy>
  );
}

/** Photo cards, like the cat grid. */
export function CatCardsSkeleton({
  cards = 10,
  className = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
}: {
  cards?: number;
  /** The grid of the list it stands in for. */
  className?: string;
}) {
  return (
    <Busy label="Cargando gatos…" className={className}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="surface overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className={cn("h-4", widths[i % widths.length])} />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="mt-1 h-5 w-16" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

/** A block the size of a map view. */
export function MapSkeleton({ className }: { className?: string }) {
  return (
    <Busy label="Cargando mapa…">
      <Skeleton className={cn("w-full rounded-xl", className)} />
    </Busy>
  );
}
