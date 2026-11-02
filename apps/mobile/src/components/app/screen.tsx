import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/utils";

/**
 * Scrollable screen body under a native header. Pull to refresh calls `onRefresh`
 * (usually the screen's query `refetch`).
 */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  className,
}: {
  children: ReactNode;
  onRefresh?: () => unknown;
  refreshing?: boolean;
  className?: string;
}) {
  const tint = useCSSVariable("--color-brand");
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={String(tint)}
          />
        ) : undefined
      }
    >
      <View className={cn("gap-5 px-4 pt-4 pb-12", className)}>{children}</View>
    </ScrollView>
  );
}
