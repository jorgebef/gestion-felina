import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { MunicipalityValue } from "@felina/client/location";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { municipalitySearchQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type { MunicipalityValue } from "@felina/client/location";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Searchable picker over the INE municipality catalogue (8.000+ entries). */
export function MunicipalityPicker({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string;
  value: MunicipalityValue | null;
  onChange: (value: MunicipalityValue | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const q = useDebounced(term.trim(), 200);
  const listId = useId();
  const results = useQuery({ ...municipalitySearchQuery(q), enabled: open && q.length >= 2 });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              "w-full justify-between bg-card font-normal",
              !value && "text-muted-foreground",
              invalid && "border-negative",
            )}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {value
              ? `${value.name}${value.provinceName ? ` (${value.provinceName})` : ""}`
              : "Busca el municipio"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-72 p-2" align="start">
        <Input
          autoFocus
          placeholder="Escribe al menos 2 letras"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-controls={listId}
          aria-label="Buscar municipio"
          className="bg-card"
        />
        <ul id={listId} role="listbox" className="mt-2 max-h-64 overflow-y-auto">
          {q.length < 2 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              Por ejemplo: «Getafe», «Vila Joiosa», «A Coruña».
            </li>
          ) : results.isPending ? (
            <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando…
            </li>
          ) : results.data?.length ? (
            results.data.map((m) => (
              <li key={m.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.code === m.code}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange({ code: m.code, name: m.name, provinceName: m.provinceName });
                    setOpen(false);
                    setTerm("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">{m.provinceName}</span>
                  </span>
                  {value?.code === m.code ? <Check className="size-4 text-brand" /> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-3 text-sm text-muted-foreground">Sin resultados.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
