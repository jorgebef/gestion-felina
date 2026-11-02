import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";

/** A form field: label, control, hint and error (like the web app's `Field`). */
export function Field({
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="text-sm font-medium text-foreground">
        {label}
        {optional ? <Text className="font-normal text-muted-foreground"> (opcional)</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text className="text-sm text-negative">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}

/** Error of a whole form (e.g. returned by the API). */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View className="rounded-lg border border-negative/20 bg-negative-soft px-3 py-2.5">
      <Text className="text-sm text-negative">{message}</Text>
    </View>
  );
}
