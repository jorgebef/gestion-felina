import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Check,
  FileText,
  Lock,
  Mail,
  MapPin,
  Ruler,
  Sparkles,
} from "lucide-react";

import { AllocationChart } from "#/components/charts/AllocationChart";
import { KeyValue, Money } from "#/components/finance";
import { OpportunityCover } from "#/components/opportunities/OpportunityCard";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { formatCurrency, formatNumber, formatPercent } from "#/lib/format";
import { localized, propertyTypeLabel, tagLabel } from "#/lib/labels";
import { opportunityQuery } from "#/lib/queries";
import { m } from "#/paraglide/messages";
import type { OpportunityDetails } from "#/server/opportunities";

export const Route = createFileRoute("/_site/opportunities/$slug")({
  loader: async ({ context, params }) => {
    const result = await context.queryClient.query(opportunityQuery(params.slug));
    if (!result) throw notFound();
    return { title: localized(result.opportunity.title) };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.title} · SpainFolio` : "SpainFolio" }],
  }),
  component: OpportunityPage,
  notFoundComponent: OpportunityNotFound,
});

function OpportunityPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opportunityQuery(slug));
  if (!data) return <OpportunityNotFound />;
  const { opportunity: o, details } = data;
  const pricePerSqm = o.askingPrice / o.sizeSqm;

  return (
    <main className="page-container pt-6">
      <Link
        to="/opportunities"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {m.opportunity_back()}
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <OpportunityCover hue={o.coverHue} className="h-64 rounded-3xl sm:h-80">
            <div className="absolute inset-x-5 bottom-5 flex flex-wrap gap-2">
              <Badge className="rounded-full border-0 bg-white/90 px-3 py-1 text-foreground">
                {propertyTypeLabel(o.type)}
              </Badge>
              {o.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="rounded-full border-0 bg-black/35 px-3 py-1 text-white backdrop-blur"
                >
                  {tagLabel(tag)}
                </Badge>
              ))}
            </div>
          </OpportunityCover>

          <div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {details
                ? details.address
                : o.city === o.province
                  ? o.city
                  : `${o.city}, ${o.province}`}
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
              {localized(o.title)}
            </h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              {localized(o.summary)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Spec
              icon={<Ruler />}
              label={m.opportunity_size()}
              value={`${formatNumber(o.sizeSqm)} m²`}
            />
            <Spec icon={<BedDouble />} label={m.opportunity_bedrooms()} value={o.bedrooms ?? "—"} />
            <Spec icon={<Bath />} label={m.opportunity_bathrooms()} value={o.bathrooms ?? "—"} />
            <Spec
              icon={<FileText />}
              label={m.opportunity_price_per_sqm()}
              value={formatCurrency(pricePerSqm)}
            />
          </div>

          {details ? (
            <MemberDetails details={details} askingPrice={o.askingPrice} />
          ) : (
            <LockedDetails slug={o.slug} />
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface space-y-5 p-6">
            <div>
              <p className="text-sm text-muted-foreground">{m.opportunities_asking_price()}</p>
              <p className="mt-1 text-[34px] leading-none font-medium">
                <Money value={o.askingPrice} />
              </p>
            </div>
            <div className="divide-y divide-border/70 border-y border-border/70">
              <KeyValue
                label={m.opportunity_gross_yield()}
                value={formatPercent(o.grossYield / 100)}
              />
              <KeyValue
                label={m.opportunity_net_yield()}
                value={details ? formatPercent(netYield(details, o.askingPrice)) : <LockedValue />}
              />
              <KeyValue
                label={m.opportunity_monthly_rent()}
                value={details ? formatCurrency(details.estimatedRent) : <LockedValue />}
              />
              <KeyValue
                label={m.opportunity_appreciation()}
                value={
                  details ? (
                    formatPercent(details.expectedAppreciation / 100, { signed: true })
                  ) : (
                    <LockedValue />
                  )
                }
              />
            </div>
            {details ? (
              <Button asChild className="h-11 w-full rounded-full">
                <a
                  href={`mailto:${details.contactEmail}?subject=${encodeURIComponent(localized(o.title))}`}
                >
                  <Mail />
                  {m.opportunity_contact_cta()}
                </a>
              </Button>
            ) : (
              <Button asChild className="h-11 w-full rounded-full">
                <Link to="/login" search={{ redirect: `/opportunities/${o.slug}` }}>
                  <Lock />
                  {m.opportunity_unlock_cta()}
                </Link>
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {details
                ? m.opportunity_contact_note({ name: details.contactName })
                : m.opportunity_unlock_note()}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function netYield(details: OpportunityDetails, askingPrice: number) {
  const investment = askingPrice + details.acquisitionCosts + details.renovationBudget;
  return ((details.estimatedRent - details.estimatedExpenses) * 12) / investment;
}

function Spec({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col gap-3 p-4">
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="figure mt-0.5 font-medium">{value}</p>
      </div>
    </div>
  );
}

function LockedValue() {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="locked-blur figure">00,0 %</span>
      <Lock className="size-3.5" />
    </span>
  );
}

function MemberDetails({
  details,
  askingPrice,
}: {
  details: OpportunityDetails;
  askingPrice: number;
}) {
  const investment = askingPrice + details.acquisitionCosts + details.renovationBudget;
  const annualNoi = (details.estimatedRent - details.estimatedExpenses) * 12;
  const paybackYears = annualNoi > 0 ? investment / annualNoi : null;
  const valueIn5Years = askingPrice * Math.pow(1 + details.expectedAppreciation / 100, 5);

  return (
    <div className="space-y-6">
      <section className="surface space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand" />
          <h2 className="font-medium">{m.opportunity_full_details()}</h2>
        </div>
        <p className="leading-relaxed text-muted-foreground">{localized(details.description)}</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {details.highlights.map((h) => (
            <li key={h.en} className="flex items-start gap-2 rounded-2xl bg-muted/70 p-3 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-positive" />
              {localized(h)}
            </li>
          ))}
        </ul>
      </section>

      <section className="surface grid gap-8 p-6 md:grid-cols-2">
        <div>
          <h2 className="font-medium">{m.opportunity_investment_breakdown()}</h2>
          <AllocationChart
            className="mt-4"
            centerLabel={m.opportunity_total_investment()}
            centerValue={formatCurrency(investment, { compact: true })}
            slices={[
              { key: "price", label: m.opportunity_asking_price_label(), value: askingPrice },
              {
                key: "costs",
                label: m.opportunity_acquisition_costs(),
                value: details.acquisitionCosts,
              },
              {
                key: "renovation",
                label: m.opportunity_renovation(),
                value: details.renovationBudget,
              },
            ].filter((s) => s.value > 0)}
          />
        </div>
        <div>
          <h2 className="font-medium">{m.opportunity_projection()}</h2>
          <div className="mt-4 divide-y divide-border/70">
            <KeyValue
              label={m.opportunity_annual_rent()}
              value={formatCurrency(details.estimatedRent * 12)}
            />
            <KeyValue
              label={m.opportunity_annual_expenses()}
              value={formatCurrency(-details.estimatedExpenses * 12)}
            />
            <KeyValue label={m.opportunity_annual_noi()} value={formatCurrency(annualNoi)} />
            <KeyValue
              label={m.opportunity_net_yield()}
              value={formatPercent(annualNoi / investment)}
            />
            <KeyValue
              label={m.opportunity_payback()}
              value={
                paybackYears ? m.opportunity_years({ years: formatNumber(paybackYears, 1) }) : "—"
              }
            />
            <KeyValue label={m.opportunity_value_5y()} value={formatCurrency(valueIn5Years)} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{m.opportunity_projection_note()}</p>
        </div>
      </section>
    </div>
  );
}

/** Placeholder content only: the real details are never sent to anonymous visitors. */
function LockedDetails({ slug }: { slug: string }) {
  return (
    <section className="surface relative overflow-hidden p-6">
      <div className="locked-blur space-y-4" aria-hidden="true">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-11/12 rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="mx-auto size-40 rounded-full border-[18px] border-brand/40" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-card/40 via-card/70 to-card/90 p-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-foreground text-white">
            <Lock className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-medium">{m.opportunity_locked_title()}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{m.opportunity_locked_body()}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild className="rounded-full">
              <Link to="/login" search={{ redirect: `/opportunities/${slug}` }}>
                {m.nav_login()}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full bg-card">
              <Link to="/login" search={{ mode: "signup", redirect: `/opportunities/${slug}` }}>
                {m.nav_get_started()}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function OpportunityNotFound() {
  return (
    <main className="page-container grid place-items-center py-24 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-medium">{m.opportunity_not_found()}</h1>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/opportunities">{m.opportunity_back()}</Link>
        </Button>
      </div>
    </main>
  );
}
