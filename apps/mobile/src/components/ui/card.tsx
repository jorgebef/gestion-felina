import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/utils";

/** White rounded panel with a hairline border (`.surface` on the web). */
export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}
      {...props}
    />
  );
}

/** Divider between rows inside a card. */
export function Separator({ className }: { className?: string }) {
  return <View className={cn("h-px bg-border", className)} />;
}
