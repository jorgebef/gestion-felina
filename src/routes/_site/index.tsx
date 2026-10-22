import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck2,
  Check,
  Landmark,
  Percent,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";

import { CashFlowChart, MiniBars } from "#/components/charts/CashFlowChart";
import { PortfolioValueChart } from "#/components/charts/PortfolioValueChart";
import { Money, TrendBadge } from "#/components/finance";
import { OpportunityCard } from "#/components/opportunities/OpportunityCard";
import { Button } from "#/components/ui/button";
import { examplePortfolio } from "#/lib/example-portfolio";
import { formatCurrency, formatMonth, formatPercent } from "#/lib/format";
import {
  cashFlowSeries,
  monthRange,
  portfolioMetrics,
  portfolioValueSeries,
  toMonthIndex,
} from "#/lib/portfolio";
import { opportunitiesQuery } from "#/lib/queries";
import { m } from "#/paraglide/messages";
import { getLocale } from "#/paraglide/runtime";

export const Route = createFileRoute("/_site/")({
  loader: ({ context }) => context.queryClient.query(opportunitiesQuery),
  component: Landing,
});

function Landing() {
  return (
    <main>
      <Hero />
      <Features />
      <Showcase />
      <HowItWorks />
      <OpportunitiesTeaser />
      <Faq />
      <FinalCta />
    </main>
  );
}

function useExample() {
  return useMemo(() => {
    const now = new Date();
    const current = toMonthIndex(now);
    const properties = examplePortfolio(now, getLocale());
    const months = monthRange(current - 11, current);
    return {
      properties,
      metrics: portfolioMetrics(properties, now),
      values: portfolioValueSeries(properties, months, current),
      flows: cashFlowSeries(properties, months),
      monthly: portfolioValueSeries(properties, monthRange(current - 47, current), current),
    };
  }, []);
}

/* ---------------------------------- Hero ---------------------------------- */

function Hero() {
  const { metrics, monthly, properties } = useExample();

  return (
    <section className="page-container pt-4">
      <div className="hero-gradient relative overflow-hidden rounded-[2rem] px-6 pt-14 pb-10 text-white sm:px-10 lg:px-14 lg:pt-20">
        <div className="hero-grain pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-40 -right-20 size-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,214,170,0.35),transparent_65%)]" />

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="rise-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20 backdrop-blur">
              <span className="size-1.5 rounded-full bg-[#ffd3a1]" />
              {m.landing_hero_eyebrow()}
            </span>
            <h1 className="mt-6 max-w-xl text-[42px] leading-[1.02] font-medium tracking-[-0.035em] sm:text-6xl">
              {m.landing_hero_title_start()}{" "}
              <span className="font-serif font-normal tracking-[-0.01em] italic">
                {m.landing_hero_title_accent()}
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
              {m.landing_hero_subtitle()}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-white px-6 text-foreground hover:bg-white/90"
              >
                <Link to="/login" search={{ mode: "signup" }}>
                  {m.landing_cta_primary()}
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 rounded-full bg-white/12 px-6 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20 hover:text-white"
              >
                <Link to="/opportunities">{m.landing_cta_secondary()}</Link>
              </Button>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              {[m.landing_hero_point_1(), m.landing_hero_point_2(), m.landing_hero_point_3()].map(
                (point) => (
                  <li key={point} className="flex items-center gap-1.5">
                    <Check className="size-4 text-[#ffd3a1]" />
                    {point}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="relative rise-in [animation-delay:120ms]">
            {/* Stacked glass cards behind the main preview */}
            <div className="absolute inset-x-8 -top-4 h-24 rounded-3xl bg-white/10 ring-1 ring-white/15" />
            <div className="absolute inset-x-4 -top-2 h-24 rounded-3xl bg-white/15 ring-1 ring-white/20" />
            <div className="relative rounded-3xl bg-white p-5 text-foreground shadow-2xl shadow-black/25 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{m.landing_preview_label()}</p>
                  <p className="mt-2 text-[34px] leading-none font-medium sm:text-4xl">
                    <Money value={metrics.totalValue} />
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendBadge value={metrics.yoyGrowthPct} />
                    {m.landing_preview_vs_last_year()}
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  {m.landing_preview_example()}
                </span>
              </div>
              <MiniBars
                values={monthly.map((d) => d.value)}
                highlightLast={6}
                className="mt-6 h-28"
              />
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>{formatMonth(monthly[0].month)}</span>
                <span>{formatMonth(monthly[monthly.length - 1].month)}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <PreviewTile label={m.kpi_net_yield()} value={formatPercent(metrics.netYield)} />
                <PreviewTile
                  label={m.kpi_monthly_cash_flow()}
                  value={formatCurrency(metrics.monthlyCashFlow, { compact: true })}
                />
                <PreviewTile label={m.kpi_properties()} value={String(properties.length)} />
              </div>
            </div>

            <div className="absolute top-[38%] -left-6 hidden rounded-2xl bg-foreground px-4 py-3 text-white shadow-xl sm:block">
              <p className="text-[11px] text-white/60">{m.kpi_equity()}</p>
              <p className="figure mt-0.5 text-sm font-medium">
                {formatCurrency(metrics.equity, { compact: true })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/70 px-3 py-2.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="figure mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/* -------------------------------- Features -------------------------------- */

function Features() {
  const features = [
    { icon: TrendingUp, title: m.feature_valuation_title(), body: m.feature_valuation_body() },
    { icon: Percent, title: m.feature_profitability_title(), body: m.feature_profitability_body() },
    { icon: Wallet, title: m.feature_income_title(), body: m.feature_income_body() },
    { icon: Receipt, title: m.feature_acquisition_title(), body: m.feature_acquisition_body() },
    { icon: CalendarCheck2, title: m.feature_payback_title(), body: m.feature_payback_body() },
    { icon: BarChart3, title: m.feature_growth_title(), body: m.feature_growth_body() },
  ];

  return (
    <section id="features" className="page-container scroll-mt-24 pt-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">{m.features_eyebrow()}</p>
        <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-[42px] sm:leading-[1.1]">
          {m.features_title()}
        </h2>
        <p className="mt-4 text-muted-foreground">{m.features_subtitle()}</p>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <article key={title} className="surface group p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
              <Icon className="size-5" strokeWidth={1.8} />
            </span>
            <h3 className="mt-6 text-[17px] font-medium tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Showcase -------------------------------- */

function Showcase() {
  const { metrics, values, flows } = useExample();

  return (
    <section className="page-container pt-28">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:items-center">
        <div>
          <p className="eyebrow">{m.showcase_eyebrow()}</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            {m.showcase_title()}
          </h2>
          <p className="mt-4 text-muted-foreground">{m.showcase_body()}</p>
          <dl className="mt-8 grid grid-cols-2 gap-3">
            <ShowcaseStat
              label={m.kpi_equity()}
              value={formatCurrency(metrics.equity, { compact: true })}
            />
            <ShowcaseStat label={m.kpi_gross_yield()} value={formatPercent(metrics.grossYield)} />
            <ShowcaseStat
              label={m.kpi_monthly_income()}
              value={formatCurrency(metrics.monthlyIncome, { compact: true })}
            />
            <ShowcaseStat
              label={m.kpi_appreciation()}
              value={formatPercent(metrics.appreciationPct, { signed: true })}
            />
          </dl>
        </div>
        <div className="surface space-y-6 p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{m.dashboard_portfolio_value()}</p>
              <p className="mt-1 text-3xl font-medium">
                <Money value={metrics.totalValue} />
              </p>
            </div>
            <TrendBadge value={metrics.yoyGrowthPct} variant="solid" />
          </div>
          <PortfolioValueChart data={values} className="h-56" />
          <div className="border-t border-border/70 pt-5">
            <p className="mb-2 text-sm text-muted-foreground">{m.dashboard_cash_flow_title()}</p>
            <CashFlowChart data={flows} className="h-48" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="figure mt-1 text-xl font-medium">{value}</dd>
    </div>
  );
}

/* ------------------------------ How it works ------------------------------ */

function HowItWorks() {
  const steps = [
    { icon: Plus, title: m.how_step1_title(), body: m.how_step1_body() },
    { icon: Landmark, title: m.how_step2_title(), body: m.how_step2_body() },
    { icon: ArrowUpRight, title: m.how_step3_title(), body: m.how_step3_body() },
  ];
  return (
    <section className="page-container pt-28">
      <div className="rounded-[2rem] bg-foreground px-6 py-14 text-white sm:px-12">
        <p className="eyebrow text-white/50">{m.how_eyebrow()}</p>
        <h2 className="mt-3 max-w-xl text-3xl font-medium tracking-tight sm:text-4xl">
          {m.how_title()}
        </h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4.5" />
                </span>
                <span className="figure text-sm text-white/40">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------- Opportunities ------------------------------ */

function OpportunitiesTeaser() {
  const { data } = useSuspenseQuery(opportunitiesQuery);
  if (!data.length) return null;

  return (
    <section className="page-container pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="eyebrow">{m.nav_opportunities()}</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            {m.landing_opportunities_title()}
          </h2>
          <p className="mt-3 text-muted-foreground">{m.landing_opportunities_body()}</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/opportunities">
            {m.landing_opportunities_cta()}
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.slice(0, 3).map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------- FAQ ---------------------------------- */

function Faq() {
  const items = [
    { q: m.faq_q1(), a: m.faq_a1() },
    { q: m.faq_q2(), a: m.faq_a2() },
    { q: m.faq_q3(), a: m.faq_a3() },
    { q: m.faq_q4(), a: m.faq_a4() },
    { q: m.faq_q5(), a: m.faq_a5() },
  ];
  return (
    <section id="faq" className="page-container scroll-mt-24 pt-28">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">{m.nav_faq()}</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">{m.faq_title()}</h2>
        </div>
        <div className="surface divide-y divide-border/70 px-6">
          {items.map(({ q, a }) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                {q}
                <Plus className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 pr-8 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Final CTA ------------------------------- */

function FinalCta() {
  return (
    <section className="page-container pt-28">
      <div className="hero-gradient relative overflow-hidden rounded-[2rem] px-6 py-16 text-center text-white sm:px-12">
        <div className="hero-grain pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-medium tracking-tight sm:text-[44px] sm:leading-[1.08]">
            {m.cta_title()}
          </h2>
          <p className="mt-4 text-white/80">{m.cta_body()}</p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 rounded-full bg-white px-7 text-foreground hover:bg-white/90"
          >
            <Link to="/login" search={{ mode: "signup" }}>
              {m.landing_cta_primary()}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
