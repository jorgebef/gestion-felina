import { Link } from "@tanstack/react-router";

import { catDisplayName, type CatSex } from "@felina/domain/felina";

import { formatAge } from "@/lib/format";

import { SexLabel, SterilizedBadge } from "./badges";
import { CatPhoto } from "./CatPhoto";

export interface CatSummary {
  id: string;
  name: string | null;
  sex: CatSex;
  birthDate: string | null;
  birthDateApproximate: boolean;
  sterilized: boolean;
  updatedAt: string;
  colonyName?: string | null;
}

export function CatCard({ cat }: { cat: CatSummary }) {
  const name = catDisplayName(cat);
  return (
    <Link
      to="/gatos/$catId"
      params={{ catId: cat.id }}
      className="surface group block overflow-hidden transition-colors hover:border-brand/30"
    >
      <CatPhoto
        catId={cat.id}
        version={cat.updatedAt}
        alt={name}
        className="aspect-square w-full"
      />
      <div className="p-3">
        <p className="truncate font-medium group-hover:underline">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <SexLabel sex={cat.sex} /> · {formatAge(cat.birthDate, cat.birthDateApproximate)}
        </p>
        {cat.colonyName !== undefined ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cat.colonyName ?? "Sin colonia"}
          </p>
        ) : null}
        <div className="mt-2">
          <SterilizedBadge sterilized={cat.sterilized} />
        </div>
      </div>
    </Link>
  );
}
