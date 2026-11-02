import { AlertTriangle, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { errorMessage } from "@felina/client/errors";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Title block at the top of a screen's content (below the native header). */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        {eyebrow ? (
          <Text className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text className="text-2xl font-semibold tracking-tight text-foreground">{title}</Text>
        ) : null}
        {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
      </View>
      {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "items-center rounded-xl border border-dashed border-border bg-card px-6 py-10",
        className,
      )}
    >
      <View className="mb-4 size-11 items-center justify-center rounded-full bg-brand-soft">
        <Icon icon={icon} color="brand" size={20} />
      </View>
      <Text className="text-center text-base font-medium text-foreground">{title}</Text>
      {description ? (
        <Text className="mt-1 text-center text-sm text-muted-foreground">{description}</Text>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View
      accessibilityRole="alert"
      className="items-center rounded-xl border border-negative/20 bg-negative-soft px-6 py-8"
    >
      <View className="mb-3">
        <Icon icon={AlertTriangle} color="negative" size={24} />
      </View>
      <Text className="text-center font-medium text-negative">{errorMessage(error)}</Text>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onPress={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </View>
  );
}

export function ForbiddenState({
  message = "No tienes permiso para ver o hacer esto.",
}: {
  message?: string;
}) {
  return (
    <View className="items-center rounded-xl border border-dashed border-border bg-card px-6 py-10">
      <View className="mb-3">
        <Icon icon={AlertTriangle} color="warning" size={24} />
      </View>
      <Text className="text-center font-medium text-foreground">{message}</Text>
    </View>
  );
}

/** Full-screen spinner (first load of a screen). */
export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  const color = useCSSVariable("--color-muted-foreground");
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator color={String(color)} />
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </View>
  );
}

/** Label/value pairs on detail screens. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <View className="gap-3">
      {items.map((item) => (
        <View key={item.label} className="gap-0.5">
          <Text className="text-xs text-muted-foreground">{item.label}</Text>
          {typeof item.value === "string" || typeof item.value === "number" ? (
            <Text className="text-base text-foreground">{item.value}</Text>
          ) : (
            item.value
          )}
        </View>
      ))}
    </View>
  );
}

/** Section title inside a screen. */
export function SectionTitle({
  icon,
  children,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("flex-row items-center gap-2", className)}>
      {icon ? <Icon icon={icon} color="brand" size={16} /> : null}
      <Text className="text-base font-semibold text-foreground">{children}</Text>
    </View>
  );
}
