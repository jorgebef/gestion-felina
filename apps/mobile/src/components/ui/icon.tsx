import type { LucideIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

/** Theme colours (packages/theme/tokens.css) usable for icons. */
export type IconColor =
  | "foreground"
  | "muted-foreground"
  | "brand"
  | "brand-strong"
  | "positive"
  | "warning"
  | "negative"
  | "primary-foreground"
  | "destructive";

/** A Lucide icon (same set as the web app) coloured with a theme token. */
export function Icon({
  icon: Glyph,
  color = "foreground",
  size = 18,
  strokeWidth = 2,
}: {
  icon: LucideIcon;
  color?: IconColor;
  size?: number;
  strokeWidth?: number;
}) {
  const value = useCSSVariable(`--color-${color}`);
  return <Glyph color={String(value ?? "#1c1917")} size={size} strokeWidth={strokeWidth} />;
}
