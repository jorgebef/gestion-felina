import type { ReactNode } from "react";

import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";

export function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: unknown;
  className?: string;
  children: ReactNode;
}) {
  const message = typeof error === "string" ? error : null;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {message ? (
        <p className="text-xs text-negative">{message}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Numeric input with a unit adornment (€, %, m², years). Value is kept as a string. */
export function UnitInput({
  id,
  value,
  onChange,
  onBlur,
  unit,
  placeholder,
  invalid,
  step = "any",
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  unit: string;
  placeholder?: string;
  invalid?: boolean;
  step?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        className="figure h-11 rounded-xl bg-card pr-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

export const inputClass = "h-11 rounded-xl bg-card";
export const selectTriggerClass = "h-11 w-full rounded-xl bg-card data-[size=default]:h-11";
