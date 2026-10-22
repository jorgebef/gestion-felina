import type { PropertyData } from "#/lib/portfolio";
import { buildSamplePortfolio } from "#/server/sample-portfolio";

/** The sample portfolio as in-memory data, used for the marketing preview. */
export function examplePortfolio(now: Date, locale: "en" | "es"): PropertyData[] {
  return buildSamplePortfolio(now, locale).map((p, i) => ({
    ...p,
    id: `example-${i}`,
    recurringItems: p.recurringItems.map((item, j) => ({ ...item, id: `r-${i}-${j}` })),
    oneOffItems: p.oneOffItems.map((item, j) => ({ ...item, id: `o-${i}-${j}` })),
    valuations: p.valuations.map((item, j) => ({ ...item, id: `v-${i}-${j}` })),
  }));
}
