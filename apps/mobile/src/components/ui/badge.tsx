import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { TONE_STYLES, type Tone } from "@felina/client/tones";

import { cn } from "@/lib/utils";

import { Icon, type IconColor } from "./icon";

const ICON_COLOR: Record<Tone, IconColor> = {
  neutral: "foreground",
  brand: "brand-strong",
  positive: "positive",
  warning: "warning",
  negative: "negative",
  muted: "muted-foreground",
};

/** Small status label, same tones as the web app. */
export function Pill({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-1 self-start rounded-md border px-1.5 py-0.5",
        TONE_STYLES[tone].box,
        className,
      )}
    >
      {icon ? <Icon icon={icon} size={12} color={ICON_COLOR[tone]} /> : null}
      <Text className={cn("text-xs font-medium", TONE_STYLES[tone].text)}>{children}</Text>
    </View>
  );
}
