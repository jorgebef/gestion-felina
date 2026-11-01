/**
 * Runs the scoring function over stored data and persists `tender_matches`. Runs as
 * an internal process (database owner connection), independent of any signed-in user.
 */
import { and, eq, gt, inArray, isNull, notInArray, or, sql } from "drizzle-orm";

import {
  getDb,
  type Database,
  alertProfiles,
  contractingAuthorities,
  cpvCodes,
  tenderLots,
  tenderMatches,
  tenders,
} from "@licita/db";
import { ACTIONABLE_STATUSES } from "@licita/domain/tenders";

import { scoreTender, type MatchProfile, type MatchTender } from "./scoring.ts";

export interface MatchRunOptions {
  /** Only these profiles (e.g. right after a profile is saved). Default: all active. */
  profileIds?: string[];
  /** Only these tenders (e.g. those changed by the last import). Default: all open. */
  tenderIds?: string[];
  now?: Date;
}

export interface MatchRunSummary {
  profiles: number;
  candidates: number;
  matches: number;
  newMatches: number;
  removed: number;
}

async function loadProfiles(db: Database, ids?: string[]): Promise<MatchProfile[]> {
  const rows = await db
    .select()
    .from(alertProfiles)
    .where(
      ids
        ? and(
            inArray(alertProfiles.id, ids.length ? ids : [crypto.randomUUID()]),
            eq(alertProfiles.isActive, true),
          )
        : eq(alertProfiles.isActive, true),
    );
  return rows.map((p) => ({
    id: p.id,
    serviceDescription: p.serviceDescription,
    cpvCodes: p.cpvCodes,
    includeKeywords: p.includeKeywords,
    excludeKeywords: p.excludeKeywords,
    provinceCodes: p.provinceCodes,
    nationwide: p.nationwide,
    contractTypes: p.contractTypes,
    minBudgetEur: p.minBudgetEur,
    maxBudgetEur: p.maxBudgetEur,
  }));
}

/** Tenders that can still receive offers (optionally limited to `ids`). */
function candidateCondition(now: Date, ids?: string[]) {
  return and(
    inArray(tenders.status, [...ACTIONABLE_STATUSES]),
    or(isNull(tenders.submissionDeadlineAt), gt(tenders.submissionDeadlineAt, now)),
    ids ? inArray(tenders.id, ids.length ? ids : [crypto.randomUUID()]) : undefined,
  );
}

async function loadCandidates(db: Database, now: Date, ids?: string[]): Promise<MatchTender[]> {
  const rows = await db
    .select({
      id: tenders.id,
      title: tenders.title,
      description: tenders.description,
      contractType: tenders.contractType,
      status: tenders.status,
      cpvCodes: tenders.cpvCodes,
      executionProvinces: tenders.executionProvinces,
      authorityProvinceCode: contractingAuthorities.provinceCode,
      baseBudgetExVatEur: tenders.baseBudgetExVatEur,
      estimatedValueEur: tenders.estimatedValueEur,
      submissionDeadlineAt: tenders.submissionDeadlineAt,
    })
    .from(tenders)
    .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
    .where(candidateCondition(now, ids));
  if (!rows.length) return [];

  const lotRows = await db
    .select({
      tenderId: tenderLots.tenderId,
      code: tenderLots.sourceLotCode,
      title: tenderLots.title,
      cpvCodes: tenderLots.cpvCodes,
    })
    .from(tenderLots)
    .where(
      inArray(
        tenderLots.tenderId,
        db.select({ id: tenders.id }).from(tenders).where(candidateCondition(now, ids)),
      ),
    );
  const lotsByTender = Map.groupBy(lotRows, (l) => l.tenderId);

  return rows.map((r) => ({
    ...r,
    authorityProvinceCode: r.authorityProvinceCode?.trim() ?? null,
    lots: (lotsByTender.get(r.id) ?? []).map(({ code, title, cpvCodes: codes }) => ({
      code,
      title,
      cpvCodes: codes,
    })),
  }));
}

async function cpvLabelLookup(db: Database, profiles: MatchProfile[], candidates: MatchTender[]) {
  const codes = new Set<string>();
  profiles.forEach((p) => p.cpvCodes.forEach((c) => codes.add(c)));
  candidates.forEach((t) => t.cpvCodes.forEach((c) => codes.add(c)));
  if (!codes.size) return () => undefined;
  const rows = await db
    .select({ code: cpvCodes.code, label: cpvCodes.labelEs })
    .from(cpvCodes)
    .where(inArray(cpvCodes.code, [...codes]));
  const labels = new Map(rows.map((r) => [r.code, r.label]));
  return (code: string) => labels.get(code);
}

export async function runMatching(
  options: MatchRunOptions = {},
  db: Database = getDb(),
): Promise<MatchRunSummary> {
  const now = options.now ?? new Date();
  const profiles = await loadProfiles(db, options.profileIds);
  const summary: MatchRunSummary = {
    profiles: profiles.length,
    candidates: 0,
    matches: 0,
    newMatches: 0,
    removed: 0,
  };
  if (!profiles.length) return summary;

  const candidates = await loadCandidates(db, now, options.tenderIds);
  summary.candidates = candidates.length;
  if (!candidates.length) return summary;
  const cpvLabel = await cpvLabelLookup(db, profiles, candidates);

  for (const profile of profiles) {
    const rows: (typeof tenderMatches.$inferInsert)[] = [];
    for (const tender of candidates) {
      const outcome = scoreTender(profile, tender, { now, cpvLabel });
      if (!outcome.matched) continue;
      rows.push({
        alertProfileId: profile.id,
        tenderId: tender.id,
        score: outcome.score,
        matchReason: outcome.reasons.join("\n"),
        matchedLotCodes: outcome.matchedLotCodes,
        calculatedAt: now,
      });
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i += 500) {
        const inserted = await tx
          .insert(tenderMatches)
          .values(rows.slice(i, i + 500))
          .onConflictDoUpdate({
            target: [tenderMatches.alertProfileId, tenderMatches.tenderId],
            set: {
              score: sql`excluded.score`,
              matchReason: sql`excluded.match_reason`,
              matchedLotCodes: sql`excluded.matched_lot_codes`,
              calculatedAt: sql`excluded.calculated_at`,
            },
          })
          // xmax = 0 only for freshly inserted rows.
          .returning({ inserted: sql<boolean>`(xmax = 0)` });
        summary.newMatches += inserted.filter((r) => r.inserted).length;
      }
      summary.matches += rows.length;

      // Evaluated tenders that no longer match lose their match, unless the user
      // already gave feedback on it (kept for history and future tuning).
      const keep = rows.map((r) => r.tenderId);
      const removed = await tx
        .delete(tenderMatches)
        .where(
          and(
            eq(tenderMatches.alertProfileId, profile.id),
            inArray(
              tenderMatches.tenderId,
              tx
                .select({ id: tenders.id })
                .from(tenders)
                .where(candidateCondition(now, options.tenderIds)),
            ),
            keep.length ? notInArray(tenderMatches.tenderId, keep) : undefined,
            isNull(tenderMatches.feedback),
          ),
        )
        .returning({ id: tenderMatches.id });
      summary.removed += removed.length;
    });
  }
  return summary;
}
