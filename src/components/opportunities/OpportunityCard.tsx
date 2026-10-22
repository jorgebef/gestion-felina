import { Link } from "@tanstack/react-router";
import { BedDouble, Lock, MapPin, Ruler } from "lucide-react";

import { Badge } from "#/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent } from "#/lib/format";
import { localized, propertyTypeLabel, tagLabel } from "#/lib/labels";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import type { PublicOpportunity } from "#/server/opportunities";

/**
 * Generated cover art: a warm sky gradient tinted by the listing's hue with a row of arches,
 * so every listing gets a distinctive image without shipping photos.
 */
export function OpportunityCover({
  hue,
  className,
  children,
}: {
  hue: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const sky = `linear-gradient(165deg, hsl(${hue} 62% 30%) 0%, hsl(${hue + 14} 70% 48%) 48%, hsl(${hue + 28} 85% 72%) 100%)`;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: sky }}>
      <div className="hero-grain absolute inset-0 opacity-60" />
      <div
        className="absolute -top-10 right-8 size-28 rounded-full opacity-80 blur-[1px]"
        style={{ background: `hsl(${hue + 34} 95% 82%)` }}
      />
      <svg
        viewBox="0 0 400 160"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[70%] w-full"
        aria-hidden="true"
      >
        <path
          d="M0 160V96h40V70h36v26h30V52h48v44h26V78h40v18h34V60h44v36h28V74h40v22h34v64z"
          fill="rgba(255,255,255,0.14)"
        />
        <g fill="rgba(255,255,255,0.9)">
          <path d="M28 160v-58h344v58z" opacity="0.18" />
          {Array.from({ length: 7 }, (_, i) => {
            const x = 40 + i * 48;
            return (
              <path
                key={i}
                d={`M${x} 160v-34a14 14 0 0 1 28 0v34z`}
                fill={`hsl(${hue} 55% 22%)`}
                opacity="0.55"
              />
            );
          })}
        </g>
      </svg>
      {children}
    </div>
  );
}

export function OpportunityCard({
  opportunity,
  className,
}: {
  opportunity: PublicOpportunity;
  className?: string;
}) {
  return (
    <Link
      to="/opportunities/$slug"
      params={{ slug: opportunity.slug }}
      className={cn(
        "group surface flex flex-col overflow-hidden p-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(21,19,15,0.25)]",
        className,
      )}
    >
      <OpportunityCover hue={opportunity.coverHue} className="h-44 rounded-[1.1rem]">
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Badge className="rounded-full border-0 bg-white/90 px-2.5 text-foreground backdrop-blur">
            {propertyTypeLabel(opportunity.type)}
          </Badge>
          <span className="figure rounded-full bg-foreground/85 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {m.opportunities_gross_yield_short({
              value: formatPercent(opportunity.grossYield / 100),
            })}
          </span>
        </div>
      </OpportunityCover>
      <div className="flex flex-1 flex-col gap-4 px-3 pt-4 pb-3">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {opportunity.city === opportunity.province
              ? opportunity.city
              : `${opportunity.city}, ${opportunity.province}`}
          </p>
          <h3 className="text-[17px] leading-snug font-medium tracking-tight">
            {localized(opportunity.title)}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {localized(opportunity.summary)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {opportunity.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tagLabel(tag)}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/70 pt-4">
          <div>
            <p className="text-xs text-muted-foreground">{m.opportunities_asking_price()}</p>
            <p className="figure text-xl font-medium">{formatCurrency(opportunity.askingPrice)}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Ruler className="size-3.5" />
              {formatNumber(opportunity.sizeSqm)} m²
            </span>
            {opportunity.bedrooms ? (
              <span className="flex items-center gap-1">
                <BedDouble className="size-3.5" />
                {opportunity.bedrooms}
              </span>
            ) : null}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          <Lock className="size-3" />
          {m.opportunities_members_teaser()}
        </p>
      </div>
    </Link>
  );
}
