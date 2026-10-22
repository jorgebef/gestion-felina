import { Building, Building2, Car, Home, Hotel, LandPlot, Store } from "lucide-react";

import { cn } from "#/lib/utils";

const ICONS = {
  apartment: Building2,
  house: Home,
  villa: Hotel,
  studio: Building,
  commercial: Store,
  parking: Car,
  land: LandPlot,
} as const;

const TINTS: Record<string, string> = {
  apartment: "bg-brand-soft text-brand",
  house: "bg-[#e9f1ec] text-olive",
  villa: "bg-[#fbf0dc] text-[#a86b12]",
  studio: "bg-[#eeebfa] text-[#5b4fb0]",
  commercial: "bg-[#e6edf6] text-[#2c4a7a]",
  parking: "bg-muted text-foreground/70",
  land: "bg-[#eef3e3] text-[#5a7a22]",
};

export function PropertyTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type as keyof typeof ICONS] ?? Building2;
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-2xl",
        TINTS[type] ?? TINTS.apartment,
        className,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} />
    </span>
  );
}
