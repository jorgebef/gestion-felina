/**
 * Placeholders for result lists while their query is fetching (first load, a filter
 * change, an invalidation after a mutation or a refetch on focus). Lists show these
 * instead of the previous results, as in the web app, so stale data never looks current.
 */
import type { ReactNode } from "react";
import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const widths = ["w-2/5", "w-1/2", "w-1/3", "w-3/5", "w-2/5", "w-1/2"];

function Busy({
  label = "Cargando resultados…",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityRole="progressbar"
    >
      {children}
    </View>
  );
}

export function RowsSkeleton({
  rows = 5,
  badges = false,
  framed = true,
  label,
}: {
  rows?: number;
  badges?: boolean;
  framed?: boolean;
  label?: string;
}) {
  const body = Array.from({ length: rows }, (_, i) => (
    <View key={i} className={cn("gap-2 px-4 py-3", i > 0 && "border-t border-border")}>
      <Skeleton className={cn("h-4", widths[i % widths.length])} />
      <Skeleton className="h-3 w-3/4" />
      {badges ? (
        <View className="flex-row gap-1.5 pt-0.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </View>
      ) : null}
    </View>
  ));
  return <Busy label={label}>{framed ? <Card>{body}</Card> : <View>{body}</View>}</Busy>;
}

export function CardsSkeleton({ cards = 4, label }: { cards?: number; label?: string }) {
  return (
    <Busy label={label}>
      <View className="gap-3">
        {Array.from({ length: cards }, (_, i) => (
          <Card key={i} className="gap-2.5 p-4">
            <View className="flex-row justify-between gap-2">
              <Skeleton className={cn("h-4", widths[i % widths.length])} />
              <Skeleton className="h-5 w-20" />
            </View>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </Card>
        ))}
      </View>
    </Busy>
  );
}

/** Photo cards in a two-column grid, like the cat grid. */
export function CatCardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Busy label="Cargando gatos…">
      <View className="flex-row flex-wrap gap-3">
        {Array.from({ length: cards }, (_, i) => (
          <Card key={i} className="w-[48%]">
            <Skeleton className="aspect-square w-full rounded-none" />
            <View className="gap-2 p-3">
              <Skeleton className={cn("h-4", widths[i % widths.length])} />
              <Skeleton className="h-3 w-3/4" />
            </View>
          </Card>
        ))}
      </View>
    </Busy>
  );
}

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <Busy label="Cargando mapa…">
      <Skeleton className={cn("h-96 w-full rounded-xl", className)} />
    </Busy>
  );
}
