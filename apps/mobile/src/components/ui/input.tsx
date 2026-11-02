import { TextInput, type TextInputProps } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/utils";

export function Input({ className, multiline, ...props }: TextInputProps & { className?: string }) {
  const placeholder = useCSSVariable("--color-muted-foreground");
  return (
    <TextInput
      placeholderTextColor={String(placeholder)}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      className={cn(
        "rounded-lg border border-input bg-card px-3 text-base text-foreground",
        multiline ? "min-h-24 py-2.5" : "h-11",
        props.editable === false && "opacity-60",
        className,
      )}
      {...props}
    />
  );
}
