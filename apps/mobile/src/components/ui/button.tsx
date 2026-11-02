import { cva, type VariantProps } from "class-variance-authority";
import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/utils";

import { Icon, type IconColor } from "./icon";

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-lg border border-transparent active:opacity-80 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary",
        outline: "border-border bg-card",
        secondary: "bg-secondary",
        ghost: "bg-transparent",
        destructive: "bg-destructive",
        link: "bg-transparent px-0",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const labelVariants = cva("font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      destructive: "text-destructive-foreground",
      link: "text-brand",
    },
    size: { default: "text-base", sm: "text-sm", lg: "text-base", icon: "text-base" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type Variant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

const ICON_COLOR: Record<Variant, IconColor> = {
  default: "primary-foreground",
  outline: "foreground",
  secondary: "foreground",
  ghost: "foreground",
  destructive: "primary-foreground",
  link: "brand",
};

export interface ButtonProps
  extends Omit<PressableProps, "children">, VariantProps<typeof buttonVariants> {
  className?: string;
  icon?: LucideIcon;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Text colour override for ghost/link buttons (e.g. destructive actions). */
  tone?: "negative";
  children?: ReactNode;
}

/** Same variants as the web app's shadcn button. */
export function Button({
  variant = "default",
  size = "default",
  className,
  icon,
  loading = false,
  tone,
  disabled,
  children,
  onPress,
  ...props
}: ButtonProps) {
  const v = variant ?? "default";
  const spinner = useCSSVariable(`--color-${ICON_COLOR[v]}`);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      onPress={(e) => {
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={String(spinner)} />
      ) : icon ? (
        <Icon icon={icon} size={size === "sm" ? 16 : 18} color={tone ?? ICON_COLOR[v]} />
      ) : null}
      {typeof children === "string" ? (
        <Text
          className={cn(labelVariants({ variant, size }), tone === "negative" && "text-negative")}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
