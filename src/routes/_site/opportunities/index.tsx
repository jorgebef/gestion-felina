import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouteContext } from "@tanstack/react-router";
import { ArrowRight, Lock, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { OpportunityCard } from "#/components/opportunities/OpportunityCard";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { propertyTypeLabel } from "#/lib/labels";
import { opportunitiesQuery } from "#/lib/queries";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/_site/opportunities/")({
  loader: ({ context }) => context.queryClient.query(opportunitiesQuery),
  head: () => ({ meta: [{ title: `${m.nav_opportunities()} · SpainFolio` }] }),
  component: OpportunitiesPage,
});

type SortKey = "newest" | "yield" | "price_asc" | "price_desc";
const ALL = "all";

function OpportunitiesPage() {
  const { data } = useSuspenseQuery(opportunitiesQuery);
  const { user } = useRouteContext({ from: "__root__" });
  const [city, setCity] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("newest");

  const cities = useMemo(() => [...new Set(data.map((o) => o.city))].sort(), [data]);
  const types = useMemo(() => [...new Set(data.map((o) => o.type))], [data]);

  const visible = useMemo(() => {
    const filtered = data.filter(
      (o) => (city === ALL || o.city === city) && (type === ALL || o.type === type),
    );
    const sorted = [...filtered];
    if (sort === "yield") sorted.sort((a, b) => b.grossYield - a.grossYield);
    if (sort === "price_asc") sorted.sort((a, b) => a.askingPrice - b.askingPrice);
    if (sort === "price_desc") sorted.sort((a, b) => b.askingPrice - a.askingPrice);
    return sorted;
  }, [data, city, type, sort]);

  return (
    <main className="page-container pt-10">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">{m.nav_opportunities()}</p>
          <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
            {m.opportunities_title()}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{m.opportunities_subtitle()}</p>
        </div>
        {!user ? (
          <div className="surface flex items-start gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <Lock className="size-4" />
            </span>
            <div className="space-y-3">
              <p className="text-sm">{m.opportunities_members_banner()}</p>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/login" search={{ redirect: "/opportunities" }}>
                  {m.opportunities_unlock_cta()}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2">
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="h-9 w-auto min-w-40 rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{m.opportunities_all_cities()}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-auto min-w-40 rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{m.opportunities_all_types()}</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {propertyTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{m.opportunities_sort_by()}</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-auto min-w-44 rounded-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">{m.opportunities_sort_newest()}</SelectItem>
              <SelectItem value="yield">{m.opportunities_sort_yield()}</SelectItem>
              <SelectItem value="price_asc">{m.opportunities_sort_price_asc()}</SelectItem>
              <SelectItem value="price_desc">{m.opportunities_sort_price_desc()}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} />
          ))}
        </div>
      ) : (
        <div className="surface mt-6 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <SearchX className="size-6 text-muted-foreground" />
          <p className="font-medium">{m.opportunities_empty_title()}</p>
          <p className="text-sm text-muted-foreground">{m.opportunities_empty_body()}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 rounded-full"
            onClick={() => {
              setCity(ALL);
              setType(ALL);
            }}
          >
            {m.opportunities_clear_filters()}
          </Button>
        </div>
      )}
    </main>
  );
}
