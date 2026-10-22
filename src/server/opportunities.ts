import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index";
import { opportunity } from "#/db/schema";
import { optionalAuthMiddleware } from "#/server/session";

/** Columns anyone can see. Everything else is only sent to signed-in members. */
const publicColumns = {
  id: opportunity.id,
  slug: opportunity.slug,
  title: opportunity.title,
  summary: opportunity.summary,
  city: opportunity.city,
  province: opportunity.province,
  type: opportunity.type,
  askingPrice: opportunity.askingPrice,
  sizeSqm: opportunity.sizeSqm,
  bedrooms: opportunity.bedrooms,
  bathrooms: opportunity.bathrooms,
  grossYield: opportunity.grossYield,
  coverHue: opportunity.coverHue,
  tags: opportunity.tags,
  publishedAt: opportunity.publishedAt,
};

export const listOpportunities = createServerFn({ method: "GET" }).handler(() =>
  db.select(publicColumns).from(opportunity).orderBy(desc(opportunity.publishedAt)),
);

export type PublicOpportunity = Awaited<ReturnType<typeof listOpportunities>>[number];

export const getOpportunity = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const [row] = await db.select().from(opportunity).where(eq(opportunity.slug, data.slug));
    if (!row) return null;

    const {
      address,
      description,
      estimatedRent,
      estimatedExpenses,
      renovationBudget,
      acquisitionCosts,
      expectedAppreciation,
      highlights,
      contactName,
      contactEmail,
      ...publicFields
    } = row;

    if (!context.user) {
      return { opportunity: publicFields, details: null };
    }
    return {
      opportunity: publicFields,
      details: {
        address,
        description,
        estimatedRent,
        estimatedExpenses,
        renovationBudget,
        acquisitionCosts,
        expectedAppreciation,
        highlights,
        contactName,
        contactEmail,
      },
    };
  });

export type OpportunityDetails = NonNullable<
  NonNullable<Awaited<ReturnType<typeof getOpportunity>>>["details"]
>;
