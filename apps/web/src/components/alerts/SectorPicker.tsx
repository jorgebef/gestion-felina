import { Check } from "lucide-react";

import { SECTORS } from "@licita/domain/sectors";
import { cn } from "@/lib/utils";

export function SectorPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = new Set(value);
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Sectores">
      {SECTORS.map((sector) => {
        const on = selected.has(sector.id);
        return (
          <button
            key={sector.id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? value.filter((id) => id !== sector.id) : [...value, sector.id].slice(0, 10),
              )
            }
            className={cn(
              "flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-brand/40",
              on && "border-brand bg-brand-soft/60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                on ? "border-brand bg-brand text-white" : "border-input",
              )}
            >
              {on ? <Check className="size-3" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{sector.label}</span>
              <span className="block text-xs text-muted-foreground">{sector.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
