/**
 * Native form controls (@expo/ui: SwiftUI on iOS, Jetpack Compose on Android). They play
 * the role of the web app's Base UI switch, checkbox, select and tabs.
 */
import { Checkbox as NativeCheckbox, Host, Picker, Switch as NativeSwitch } from "@expo/ui";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import NativeSegmentedControl from "@expo/ui/community/segmented-control";
import { Calendar } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/utils";

import { Icon } from "./icon";

/** Native controls take the brand colour (Material palette on Android, tint on iOS). */
function useSeedColor(): string {
  return String(useCSSVariable("--color-brand"));
}

/** A toggle row: label (and description) on the left, native switch on the right. */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const seedColor = useSeedColor();
  return (
    <View
      className={cn(
        "flex-row items-center justify-between gap-4 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-foreground">{label}</Text>
        {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
      </View>
      <Host matchContents seedColor={seedColor}>
        <NativeSwitch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          testID={label}
        />
      </Host>
    </View>
  );
}

export function Checkbox({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const seedColor = useSeedColor();
  return (
    <Host matchContents seedColor={seedColor}>
      <NativeCheckbox
        label={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </Host>
  );
}

/**
 * Single choice from a short list, shown as a native menu (the web app's `Select`).
 * `items` maps each value to its label, like the web `Select`'s `items` prop.
 */
export function Select<T extends string>({
  value,
  items,
  onValueChange,
  disabled,
  className,
}: {
  value: T;
  items: Record<T, string>;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const seedColor = useSeedColor();
  return (
    <View
      className={cn(
        "min-h-11 justify-center self-stretch",
        // Android's Compose dropdown draws its own field; iOS shows a bare menu button.
        Platform.OS === "ios" && "rounded-lg border border-input bg-card px-1",
        disabled && "opacity-60",
        className,
      )}
    >
      <Host matchContents={{ vertical: true }} seedColor={seedColor}>
        <Picker
          selectedValue={value}
          onValueChange={(v) => onValueChange(v as T)}
          enabled={!disabled}
          appearance="menu"
        >
          {(Object.entries(items) as [T, string][]).map(([v, label]) => (
            <Picker.Item key={v} label={label} value={v} />
          ))}
        </Picker>
      </Host>
    </View>
  );
}

/** Segmented tabs that filter a list (the web app's `Tabs`). */
export function SegmentedControl<T extends string>({
  value,
  items,
  onValueChange,
  className,
}: {
  value: T;
  items: Record<T, string>;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  const keys = Object.keys(items) as T[];
  return (
    <View className={className}>
      <NativeSegmentedControl
        values={keys.map((k) => items[k])}
        selectedIndex={Math.max(0, keys.indexOf(value))}
        onChange={(e) => {
          const next = keys[e.nativeEvent.selectedSegmentIndex];
          if (next !== undefined && next !== value) onValueChange(next);
        }}
      />
    </View>
  );
}

const dateLabel = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const dateTimeLabel = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
const dialogButtons = {
  positiveButton: { label: "Aceptar" },
  negativeButton: { label: "Cancelar" },
};

/**
 * Native date (or date and time) picker: inline compact picker on iOS; on Android a field
 * that opens the Material date dialog (then the time dialog in "datetime" mode).
 */
export function DateField({
  value,
  onChange,
  mode = "date",
  minimumDate,
  maximumDate,
  disabled,
}: {
  value: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "datetime";
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
}) {
  const brand = String(useCSSVariable("--color-brand"));
  const [step, setStep] = useState<"closed" | "date" | "time">("closed");
  const [picked, setPicked] = useState(value);

  if (Platform.OS === "ios") {
    return (
      <View className="flex-row" pointerEvents={disabled ? "none" : "auto"}>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={brand}
          onValueChange={(_, date) => onChange(date)}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setStep("date")}
        className={cn(
          "h-11 flex-row items-center gap-2 self-stretch rounded-lg border border-input bg-card px-3",
          disabled && "opacity-60",
        )}
      >
        <Icon icon={Calendar} color="muted-foreground" size={16} />
        <Text className="text-base text-foreground">
          {(mode === "datetime" ? dateTimeLabel : dateLabel).format(value)}
        </Text>
      </Pressable>
      {step === "date" ? (
        <DateTimePicker
          value={value}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={brand}
          {...dialogButtons}
          onDismiss={() => setStep("closed")}
          onValueChange={(_, date) => {
            if (mode === "datetime") {
              setPicked(date);
              setStep("time");
            } else {
              setStep("closed");
              onChange(date);
            }
          }}
        />
      ) : null}
      {step === "time" ? (
        <DateTimePicker
          value={picked}
          mode="time"
          is24Hour
          accentColor={brand}
          {...dialogButtons}
          onDismiss={() => setStep("closed")}
          onValueChange={(_, date) => {
            setStep("closed");
            onChange(date);
          }}
        />
      ) : null}
    </>
  );
}
