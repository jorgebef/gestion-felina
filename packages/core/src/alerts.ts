import { and, count, desc, eq, sql } from "drizzle-orm";

import { alertProfiles, tenderMatches, withTenant } from "@licita/db";
import { runMatching } from "@licita/matching/engine";
import type { AlertProfileValues } from "@licita/schemas/alert-profile";
import type { CpvSuggestInput } from "@licita/schemas/cpv";

import { DomainError, type CompanyContext } from "./context.ts";
import { cpvLabels, searchCpv, suggestCpv } from "./cpv.ts";

function profileColumns(values: AlertProfileValues) {
  return {
    name: values.name,
    serviceDescription: values.serviceDescription,
    sectors: values.sectors,
    cpvCodes: values.cpvCodes,
    includeKeywords: values.includeKeywords,
    excludeKeywords: values.excludeKeywords,
    provinceCodes: values.provinceCodes,
    nationwide: values.nationwide,
    contractTypes: values.contractTypes,
    minBudgetEur: values.minBudgetEur,
    maxBudgetEur: values.maxBudgetEur,
    emailFrequency: values.emailFrequency,
    isActive: values.isActive,
  };
}

/** Recomputes matches of one profile right away so the user sees results immediately. */
async function rematchProfile(profileId: string) {
  try {
    return await runMatching({ profileIds: [profileId] });
  } catch (error) {
    // The scheduled `sync`/`rematch` jobs will catch up; saving must not fail for this.
    console.error("[alerts] immediate matching failed", error);
    return null;
  }
}

export function listAlertProfiles(ctx: CompanyContext) {
  return withTenant(ctx.user.id, (tx) =>
    tx
      .select({
        id: alertProfiles.id,
        name: alertProfiles.name,
        serviceDescription: alertProfiles.serviceDescription,
        isActive: alertProfiles.isActive,
        emailFrequency: alertProfiles.emailFrequency,
        provinceCodes: alertProfiles.provinceCodes,
        nationwide: alertProfiles.nationwide,
        contractTypes: alertProfiles.contractTypes,
        cpvCount: sql<number>`cardinality(${alertProfiles.cpvCodes})`,
        keywordCount: sql<number>`cardinality(${alertProfiles.includeKeywords})`,
        updatedAt: alertProfiles.updatedAt,
        matchCount: count(tenderMatches.id),
      })
      .from(alertProfiles)
      .leftJoin(tenderMatches, eq(tenderMatches.alertProfileId, alertProfiles.id))
      .where(eq(alertProfiles.companyId, ctx.company.id))
      .groupBy(alertProfiles.id)
      .orderBy(desc(alertProfiles.isActive), desc(alertProfiles.updatedAt)),
  );
}

export function getAlertProfile(ctx: CompanyContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const [profile] = await tx
      .select()
      .from(alertProfiles)
      .where(and(eq(alertProfiles.id, id), eq(alertProfiles.companyId, ctx.company.id)));
    if (!profile) throw new DomainError("NOT_FOUND");
    return { ...profile, cpvOptions: await cpvLabels(tx, profile.cpvCodes) };
  });
}

export async function createAlertProfile(ctx: CompanyContext, data: AlertProfileValues) {
  const [created] = await withTenant(ctx.user.id, (tx) =>
    tx
      .insert(alertProfiles)
      .values({ ...profileColumns(data), companyId: ctx.company.id })
      .returning({ id: alertProfiles.id }),
  );
  const matching = await rematchProfile(created!.id);
  return { id: created!.id, matches: matching?.matches ?? null };
}

export async function updateAlertProfile(
  ctx: CompanyContext,
  id: string,
  values: AlertProfileValues,
) {
  const updated = await withTenant(ctx.user.id, (tx) =>
    tx
      .update(alertProfiles)
      .set(profileColumns(values))
      .where(and(eq(alertProfiles.id, id), eq(alertProfiles.companyId, ctx.company.id)))
      .returning({ id: alertProfiles.id }),
  );
  if (!updated.length) throw new DomainError("NOT_FOUND");
  const matching = await rematchProfile(id);
  return { id, matches: matching?.matches ?? null };
}

export async function setAlertProfileActive(ctx: CompanyContext, id: string, isActive: boolean) {
  const updated = await withTenant(ctx.user.id, (tx) =>
    tx
      .update(alertProfiles)
      .set({ isActive })
      .where(and(eq(alertProfiles.id, id), eq(alertProfiles.companyId, ctx.company.id)))
      .returning({ id: alertProfiles.id }),
  );
  if (!updated.length) throw new DomainError("NOT_FOUND");
  if (isActive) await rematchProfile(id);
  return { ok: true as const };
}

export async function deleteAlertProfile(ctx: CompanyContext, id: string) {
  const deleted = await withTenant(ctx.user.id, (tx) =>
    tx
      .delete(alertProfiles)
      .where(and(eq(alertProfiles.id, id), eq(alertProfiles.companyId, ctx.company.id)))
      .returning({ id: alertProfiles.id }),
  );
  if (!deleted.length) throw new DomainError("NOT_FOUND");
  return { ok: true as const };
}

export function suggestCpvCodes(ctx: CompanyContext, data: CpvSuggestInput) {
  return withTenant(ctx.user.id, (tx) => suggestCpv(tx, data));
}

export function searchCpvCodes(ctx: CompanyContext, q: string) {
  return withTenant(ctx.user.id, (tx) => searchCpv(tx, q));
}
