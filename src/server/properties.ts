import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index";
import { oneOffItem, property, recurringItem, valuation } from "#/db/schema";
import {
  createPropertySchema,
  oneOffItemSchema,
  propertyInputSchema,
  recurringItemSchema,
  valuationSchema,
} from "#/lib/schemas";
import { buildSamplePortfolio } from "#/server/sample-portfolio";
import { authMiddleware } from "#/server/session";

const withItems = {
  recurringItems: { orderBy: (t, { asc }) => [asc(t.createdAt)] },
  oneOffItems: { orderBy: (t, { desc }) => [desc(t.date)] },
  valuations: { orderBy: (t, { asc }) => [asc(t.date)] },
} satisfies NonNullable<Parameters<typeof db.query.property.findMany>[0]>["with"];

async function assertOwnership(userId: string, propertyId: string) {
  const row = await db.query.property.findFirst({
    columns: { id: true },
    where: and(eq(property.id, propertyId), eq(property.userId, userId)),
  });
  if (!row) throw new Error("NOT_FOUND");
}

export const listProperties = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) =>
    db.query.property.findMany({
      where: eq(property.userId, context.user.id),
      with: withItems,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
  );

export type PropertyWithItems = Awaited<ReturnType<typeof listProperties>>[number];

export const getProperty = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const row = await db.query.property.findFirst({
      where: and(eq(property.id, data.id), eq(property.userId, context.user.id)),
      with: withItems,
    });
    return row ?? null;
  });

export const createProperty = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createPropertySchema)
  .handler(async ({ data, context }) => {
    const { recurringItems, ...fields } = data;
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(property)
        .values({ ...normaliseMortgage(fields), userId: context.user.id })
        .returning({ id: property.id });
      if (recurringItems.length) {
        await tx
          .insert(recurringItem)
          .values(recurringItems.map((item) => ({ ...item, propertyId: created.id })));
      }
      return created;
    });
  });

export const updateProperty = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1), values: propertyInputSchema }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.id);
    await db.update(property).set(normaliseMortgage(data.values)).where(eq(property.id, data.id));
    return { id: data.id };
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    await db
      .delete(property)
      .where(and(eq(property.id, data.id), eq(property.userId, context.user.id)));
    return { ok: true };
  });

function normaliseMortgage<T extends z.infer<typeof propertyInputSchema>>(values: T): T {
  if (values.hasMortgage) {
    return { ...values, mortgageStartDate: values.mortgageStartDate ?? values.purchaseDate };
  }
  return {
    ...values,
    mortgagePrincipal: 0,
    mortgageInterestRate: 0,
    mortgageTermYears: 0,
    mortgageStartDate: null,
    mortgagePaidOff: 0,
  };
}

/* ------------------------------ Recurring items ----------------------------- */

export const addRecurringItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ propertyId: z.string().min(1), item: recurringItemSchema }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    await db.insert(recurringItem).values({ ...data.item, propertyId: data.propertyId });
    return { ok: true };
  });

export const updateRecurringItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({ propertyId: z.string().min(1), id: z.string().min(1), item: recurringItemSchema }),
  )
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    await db
      .update(recurringItem)
      .set(data.item)
      .where(and(eq(recurringItem.id, data.id), eq(recurringItem.propertyId, data.propertyId)));
    return { ok: true };
  });

export const deleteRecurringItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ propertyId: z.string().min(1), id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    await db
      .delete(recurringItem)
      .where(and(eq(recurringItem.id, data.id), eq(recurringItem.propertyId, data.propertyId)));
    return { ok: true };
  });

/* ------------------------------- One-off items ------------------------------ */

export const addOneOffItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ propertyId: z.string().min(1), item: oneOffItemSchema }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    await db.insert(oneOffItem).values({ ...data.item, propertyId: data.propertyId });
    return { ok: true };
  });

export const deleteOneOffItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ propertyId: z.string().min(1), id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    await db
      .delete(oneOffItem)
      .where(and(eq(oneOffItem.id, data.id), eq(oneOffItem.propertyId, data.propertyId)));
    return { ok: true };
  });

/* -------------------------------- Valuations -------------------------------- */

export const addValuation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ propertyId: z.string().min(1), valuation: valuationSchema }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    const month = data.valuation.date.slice(0, 7);
    await db.transaction(async (tx) => {
      // Keep a single valuation per month: the newest entry replaces the previous one.
      const existing = await tx.query.valuation.findMany({
        columns: { id: true, date: true },
        where: eq(valuation.propertyId, data.propertyId),
      });
      for (const row of existing) {
        if (row.date.slice(0, 7) === month) {
          await tx.delete(valuation).where(eq(valuation.id, row.id));
        }
      }
      await tx.insert(valuation).values({ ...data.valuation, propertyId: data.propertyId });

      const latest = await tx.query.valuation.findFirst({
        where: eq(valuation.propertyId, data.propertyId),
        orderBy: (t, { desc }) => [desc(t.date)],
      });
      if (latest && latest.date === data.valuation.date) {
        await tx
          .update(property)
          .set({ currentValue: data.valuation.value })
          .where(eq(property.id, data.propertyId));
      }
    });
    return { ok: true };
  });

export const deleteValuation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ propertyId: z.string().min(1), id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    await assertOwnership(context.user.id, data.propertyId);
    await db
      .delete(valuation)
      .where(and(eq(valuation.id, data.id), eq(valuation.propertyId, data.propertyId)));
    return { ok: true };
  });

/* ------------------------------ Sample portfolio ---------------------------- */

export const createSamplePortfolio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ locale: z.enum(["en", "es"]) }))
  .handler(async ({ data, context }) => {
    const samples = buildSamplePortfolio(new Date(), data.locale);
    await db.transaction(async (tx) => {
      for (const sample of samples) {
        const { recurringItems, oneOffItems, valuations, ...fields } = sample;
        const [created] = await tx
          .insert(property)
          .values({ ...fields, userId: context.user.id })
          .returning({ id: property.id });
        await tx
          .insert(recurringItem)
          .values(recurringItems.map((item) => ({ ...item, propertyId: created.id })));
        if (oneOffItems.length) {
          await tx
            .insert(oneOffItem)
            .values(oneOffItems.map((item) => ({ ...item, propertyId: created.id })));
        }
        await tx
          .insert(valuation)
          .values(valuations.map((item) => ({ ...item, propertyId: created.id })));
      }
    });
    return { count: samples.length };
  });
