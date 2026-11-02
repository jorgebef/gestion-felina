import { Text as RNText, type TextProps } from "react-native";

import { cn } from "@/lib/utils";

/** Body text in the app's default colour and size. */
export function Text({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cn("text-base text-foreground", className)} {...props} />;
}

/** Small uppercase label above a title (`.eyebrow` on the web). */
export function Eyebrow({ className, ...props }: TextProps & { className?: string }) {
  return (
    <RNText
      className={cn(
        "text-xs font-medium tracking-widest text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}
