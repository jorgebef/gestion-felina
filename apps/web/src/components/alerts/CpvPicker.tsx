import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";
import { api } from "@/lib/api";

export interface CpvOption {
  code: string;
  label: string;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function CpvRow({
  option,
  action,
}: {
  option: CpvOption & { reason?: string };
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="tabular mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
        {option.code}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        {option.label}
        {option.reason ? (
          <span className="block text-xs text-muted-foreground">{option.reason}</span>
        ) : null}
      </span>
      {action}
    </li>
  );
}

/**
 * CPV codes are optional and never imposed: suggestions (from the chosen sectors and
 * the description) must be added one by one, and every code can be removed.
 */
export function CpvPicker({
  value,
  onChange,
  description,
  sectors,
}: {
  value: CpvOption[];
  onChange: (next: CpvOption[]) => void;
  description: string;
  sectors: string[];
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query.trim(), 250);
  const selected = new Set(value.map((v) => v.code));

  const suggestions = useMutation({
    mutationFn: () =>
      api().cpv.suggest({ description, sectors, exclude: value.map((v) => v.code) }),
  });

  const search = useQuery({
    queryKey: ["cpv-search", debouncedQuery],
    queryFn: () => api().cpv.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: Infinity,
  });

  const add = (option: CpvOption) => {
    if (!selected.has(option.code))
      onChange([...value, { code: option.code, label: option.label }]);
  };

  const pending = (suggestions.data ?? []).filter((s) => !selected.has(s.code));

  return (
    <div className="space-y-4">
      {value.length ? (
        <ul
          className="divide-y rounded-lg border bg-card px-3"
          aria-label="Códigos CPV seleccionados"
        >
          {value.map((option) => (
            <CpvRow
              key={option.code}
              option={option}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${option.code}`}
                  onClick={() => onChange(value.filter((v) => v.code !== option.code))}
                >
                  <X />
                </Button>
              }
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed bg-card px-3 py-3 text-sm text-muted-foreground">
          Sin códigos CPV. No pasa nada: también buscamos por tu descripción y palabras clave.
        </p>
      )}

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Sugerencias</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-card"
            disabled={suggestions.isPending || (description.trim().length < 5 && !sectors.length)}
            onClick={() => suggestions.mutate()}
          >
            {suggestions.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Sugerir a partir de mi descripción
          </Button>
        </div>
        {suggestions.isError ? (
          <p className="mt-2 text-xs text-negative">{errorMessage(suggestions.error)}</p>
        ) : null}
        {suggestions.isSuccess ? (
          pending.length ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Son propuestas: añade solo las que describan tu actividad.
              </p>
              <ul className="mt-1 divide-y">
                {pending.map((s) => (
                  <CpvRow
                    key={s.code}
                    option={s}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="bg-card"
                        onClick={() => add(s)}
                      >
                        <Plus />
                        Añadir
                      </Button>
                    }
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No hay más sugerencias. Prueba a detallar tu descripción o elegir un sector.
            </p>
          )
        ) : null}
      </div>

      <div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el catálogo CPV: «limpieza», «alumbrado», 4521…"
            aria-label="Buscar código CPV"
            className="bg-card pl-9"
          />
        </div>
        {debouncedQuery.length >= 2 ? (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border bg-card px-3">
            {search.isFetching && !search.data ? (
              <p className="py-3 text-sm text-muted-foreground">Buscando…</p>
            ) : search.data?.length ? (
              <ul className="divide-y">
                {search.data.map((option) => (
                  <CpvRow
                    key={option.code}
                    option={option}
                    action={
                      selected.has(option.code) ? (
                        <span className="text-xs text-muted-foreground">Añadido</span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => add(option)}
                        >
                          <Plus />
                          Añadir
                        </Button>
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Sin resultados en el catálogo CPV.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
