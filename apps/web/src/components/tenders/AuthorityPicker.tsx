import { useQuery } from "@tanstack/react-query";
import { Building2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function AuthorityPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value?: { id: string; name: string };
  onChange: (value: { id: string; name: string } | undefined) => void;
}) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const results = useQuery({
    queryKey: ["authorities", term],
    queryFn: () => api().authorities.search(term),
    enabled: term.length >= 2,
    staleTime: 5 * 60_000,
  });

  if (value) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{value.name}</span>
        <button type="button" aria-label="Quitar organismo" onClick={() => onChange(undefined)}>
          <X className="size-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={text}
        autoComplete="off"
        placeholder="Escribe al menos 2 letras: «Ayuntamiento de Sevilla»"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
      />
      {open && term.length >= 2 ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {results.data?.length ? (
            results.data.map((a) => (
              <li key={a.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(a);
                    setText("");
                    setOpen(false);
                  }}
                >
                  {a.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              {results.isFetching ? "Buscando…" : "Sin resultados"}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
