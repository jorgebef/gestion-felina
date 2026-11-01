import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { provincesByRegion } from "@licita/domain/provinces";
import { normalizeText } from "@licita/domain/text";

const GROUPS = provincesByRegion();

export function ProvincePicker({
  value,
  nationwide,
  onChange,
  onNationwideChange,
}: {
  value: string[];
  nationwide: boolean;
  onChange: (codes: string[]) => void;
  onNationwideChange: (nationwide: boolean) => void;
}) {
  const [filter, setFilter] = useState("");
  const selected = new Set(value);
  const groups = useMemo(() => {
    const q = normalizeText(filter);
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      provinces: normalizeText(g.region).includes(q)
        ? g.provinces
        : g.provinces.filter((p) => normalizeText(p.name).includes(q)),
    })).filter((g) => g.provinces.length);
  }, [filter]);

  const toggle = (codes: string[], on: boolean) => {
    const next = new Set(selected);
    codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
    onChange([...next].sort());
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
        <span>
          <span className="block text-sm font-medium">Toda España</span>
          <span className="block text-xs text-muted-foreground">
            Recibe licitaciones de cualquier provincia.
          </span>
        </span>
        <Switch
          checked={nationwide}
          onCheckedChange={onNationwideChange}
          aria-label="Toda España"
        />
      </label>

      {!nationwide ? (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar provincia o comunidad"
              aria-label="Buscar provincia"
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              {value.length} seleccionadas
            </span>
          </div>
          <div className="grid max-h-80 gap-4 overflow-y-auto p-3 sm:grid-cols-2">
            {groups.map((group) => {
              const codes = group.provinces.map((p) => p.code);
              const all = codes.every((c) => selected.has(c));
              const some = !all && codes.some((c) => selected.has(c));
              return (
                <fieldset key={group.region} className="space-y-1.5">
                  <legend className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      id={`region-${group.region}`}
                      checked={all ? true : some ? "indeterminate" : false}
                      onCheckedChange={(on) => toggle(codes, on === true)}
                    />
                    <Label htmlFor={`region-${group.region}`}>{group.region}</Label>
                  </legend>
                  {group.provinces.length > 1 || group.provinces[0]!.name !== group.region
                    ? group.provinces.map((p) => (
                        <div key={p.code} className="flex items-center gap-2 pl-6">
                          <Checkbox
                            id={`prov-${p.code}`}
                            checked={selected.has(p.code)}
                            onCheckedChange={(on) => toggle([p.code], on === true)}
                          />
                          <Label htmlFor={`prov-${p.code}`} className="font-normal">
                            {p.name}
                          </Label>
                        </div>
                      ))
                    : null}
                </fieldset>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
