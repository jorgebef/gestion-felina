/**
 * Read queries over public tender data, joined with the caller's private data
 * (matches, tracking). Always executed inside `withTenant`, so RLS limits the private
 * joins to the caller's own company. The only exception is `getPublicStats`, which
 * aggregates public data for the landing page.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  alertProfiles,
  contractingAuthorities,
  getDb,
  importRuns,
  inSequence,
  tenderEvents,
  tenderLots,
  tenderMatches,
  tenderSources,
  tenders,
  trackedTenders,
  withTenant,
  type TenantTx,
} from "@licita/db";
import {
  ACTIONABLE_STATUSES,
  type TenderEventPayload,
  type TenderStatusValue,
  type TenderSummary,
} from "@licita/domain/tenders";
import { tokenize } from "@licita/domain/text";
import { PAGE_SIZE, type TenderSearch } from "@licita/schemas/tender-search";
import { cpvPrefix } from "@licita/matching/scoring";

import { DomainError, type CompanyContext } from "./context.ts";
import { cpvLabels } from "./cpv.ts";

function madridDayStart(day: string): Date {
  // Dates in filters are calendar days in Spain; +01/+02 offsets are close enough for
  // day-level filtering (deadlines are published in local time).
  return new Date(`${day}T00:00:00+01:00`);
}

function madridDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999+01:00`);
}

/** websearch syntax ("limpieza -viaria", "\"alumbrado público\"") on unaccented text. */
function textQuery(q: string): SQL {
  return sql`websearch_to_tsquery('spanish', app_unaccent(${q}))`;
}

export function searchConditions(search: TenderSearch, now: Date): SQL[] {
  const conditions: SQL[] = [];
  if (search.q && tokenize(search.q).length) {
    conditions.push(sql`${tenders.searchDocument} @@ ${textQuery(search.q)}`);
  }
  if (search.cpv) {
    const prefix = `${cpvPrefix(search.cpv.padEnd(8, "0"))}%`;
    conditions.push(
      sql`exists (select 1 from unnest(${tenders.cpvCodes}) c where c like ${prefix})`,
    );
  }
  if (search.type) conditions.push(eq(tenders.contractType, search.type));
  if (search.province) {
    conditions.push(sql`${tenders.executionProvinces} @> array[${search.province}]::text[]`);
  }
  if (search.authority) conditions.push(eq(tenders.authorityId, search.authority));
  if (search.minBudget != null) conditions.push(gte(tenders.baseBudgetExVatEur, search.minBudget));
  if (search.maxBudget != null) conditions.push(lte(tenders.baseBudgetExVatEur, search.maxBudget));
  if (search.publishedFrom) {
    conditions.push(gte(tenders.firstPublishedAt, madridDayStart(search.publishedFrom)));
  }
  if (search.publishedTo) {
    conditions.push(lte(tenders.firstPublishedAt, madridDayEnd(search.publishedTo)));
  }
  if (search.deadlineFrom) {
    conditions.push(gte(tenders.submissionDeadlineAt, madridDayStart(search.deadlineFrom)));
  }
  if (search.deadlineTo) {
    conditions.push(lte(tenders.submissionDeadlineAt, madridDayEnd(search.deadlineTo)));
  }
  const status = search.status ?? "active";
  if (status === "active") {
    conditions.push(
      inArray(tenders.status, [...ACTIONABLE_STATUSES]),
      or(isNull(tenders.submissionDeadlineAt), gte(tenders.submissionDeadlineAt, now))!,
    );
  } else if (status !== "all") {
    conditions.push(eq(tenders.status, status as TenderStatusValue));
  }
  return conditions;
}

/** Best match score of the caller's company for each tender (RLS-scoped). */
const companyBestScore = sql<number | null>`(
  select max(${tenderMatches.score}) from ${tenderMatches}
  where ${tenderMatches.tenderId} = ${tenders.id}
)`.mapWith(Number);

const trackedStatus = sql<string | null>`(
  select ${trackedTenders.workflowStatus} from ${trackedTenders}
  where ${trackedTenders.tenderId} = ${tenders.id} limit 1
)`;

export const tenderListColumns = {
  id: tenders.id,
  title: tenders.title,
  expedienteNumber: tenders.expedienteNumber,
  status: tenders.status,
  contractType: tenders.contractType,
  procedureType: tenders.procedureType,
  mainCpvCode: tenders.mainCpvCode,
  executionProvinces: tenders.executionProvinces,
  baseBudgetExVatEur: tenders.baseBudgetExVatEur,
  estimatedValueEur: tenders.estimatedValueEur,
  firstPublishedAt: tenders.firstPublishedAt,
  submissionDeadlineAt: tenders.submissionDeadlineAt,
  authorityName: contractingAuthorities.name,
  bestScore: companyBestScore,
  trackedStatus,
};

export type TenderListItem = Awaited<ReturnType<typeof searchTenders>>["items"][number];

export async function searchTenders(tx: TenantTx, search: TenderSearch, now = new Date()) {
  const conditions = searchConditions(search, now);
  const where = conditions.length ? and(...conditions) : undefined;
  const page = search.page ?? 1;
  const hasText = Boolean(search.q && tokenize(search.q).length);
  const sort = search.sort ?? (hasText ? "relevance" : "recent");

  const order: SQL[] =
    sort === "deadline"
      ? [sql`${tenders.submissionDeadlineAt} asc nulls last`]
      : sort === "budget"
        ? [sql`${tenders.baseBudgetExVatEur} desc nulls last`]
        : sort === "relevance" && hasText
          ? [sql`ts_rank_cd(${tenders.searchDocument}, ${textQuery(search.q!)}) desc`]
          : sort === "relevance"
            ? [sql`${companyBestScore} desc nulls last`]
            : [sql`${tenders.firstPublishedAt} desc nulls last`];
  order.push(desc(tenders.id));

  // Queries in a transaction share one connection, so they run one after another.
  const items = await tx
    .select(tenderListColumns)
    .from(tenders)
    .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
    .where(where)
    .orderBy(...order)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const [counted] = await tx
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(tenders)
    .where(where);
  const total = counted?.total ?? 0;
  return { items, total, page, pageSize: PAGE_SIZE, pageCount: Math.ceil(total / PAGE_SIZE) };
}

export async function getTenderDetail(tx: TenantTx, id: string) {
  const [tender] = await tx
    .select({
      tender: tenders,
      authority: contractingAuthorities,
    })
    .from(tenders)
    .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
    .where(eq(tenders.id, id));
  if (!tender) return null;

  const [lots, events, sources, matches, [tracked]] = await inSequence([
    tx
      .select()
      .from(tenderLots)
      .where(eq(tenderLots.tenderId, id))
      .orderBy(
        sql`case when ${tenderLots.sourceLotCode} ~ '^[0-9]+$' then ${tenderLots.sourceLotCode}::int end`,
        asc(tenderLots.sourceLotCode),
      ),
    tx
      .select({
        id: tenderEvents.id,
        eventType: tenderEvents.eventType,
        headline: tenderEvents.headline,
        details: tenderEvents.details,
        effectiveAt: tenderEvents.effectiveAt,
        officialUrl: tenderEvents.officialUrl,
        payload: tenderEvents.payload,
      })
      .from(tenderEvents)
      .where(eq(tenderEvents.tenderId, id))
      .orderBy(sql`${tenderEvents.effectiveAt} desc nulls last`, desc(tenderEvents.createdAt)),
    tx
      .select({
        id: tenderSources.id,
        sourcePlatform: tenderSources.sourcePlatform,
        externalRecordId: tenderSources.externalRecordId,
        officialUrl: tenderSources.officialUrl,
        sourceUpdatedAt: tenderSources.sourceUpdatedAt,
        firstSeenAt: tenderSources.firstSeenAt,
        lastSeenAt: tenderSources.lastSeenAt,
      })
      .from(tenderSources)
      .where(eq(tenderSources.tenderId, id)),
    tx
      .select({
        id: tenderMatches.id,
        profileId: alertProfiles.id,
        profileName: alertProfiles.name,
        score: tenderMatches.score,
        matchReason: tenderMatches.matchReason,
        matchedLotCodes: tenderMatches.matchedLotCodes,
        feedback: tenderMatches.feedback,
      })
      .from(tenderMatches)
      .innerJoin(alertProfiles, eq(alertProfiles.id, tenderMatches.alertProfileId))
      .where(eq(tenderMatches.tenderId, id))
      .orderBy(desc(tenderMatches.score)),
    tx
      .select({ id: trackedTenders.id, workflowStatus: trackedTenders.workflowStatus })
      .from(trackedTenders)
      .where(eq(trackedTenders.tenderId, id)),
  ]);

  const cpvOptions = await cpvLabels(tx, tender.tender.cpvCodes);
  const { searchDocument: _omit, rawSummary, ...tenderFields } = tender.tender;
  return {
    tender: { ...tenderFields, rawSummary: rawSummary as TenderSummary },
    authority: tender.authority,
    lots,
    events: events.map((e) => ({ ...e, payload: e.payload as TenderEventPayload })),
    sources,
    matches,
    tracked: tracked ?? null,
    cpvOptions,
  };
}

export async function searchAuthorities(tx: TenantTx, q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  return tx
    .select({ id: contractingAuthorities.id, name: contractingAuthorities.name })
    .from(contractingAuthorities)
    .where(ilike(contractingAuthorities.name, `%${term.replace(/[%_\\]/g, "\\$&")}%`))
    .orderBy(asc(contractingAuthorities.name))
    .limit(15);
}

export async function authorityName(tx: TenantTx, id: string) {
  const [row] = await tx
    .select({ id: contractingAuthorities.id, name: contractingAuthorities.name })
    .from(contractingAuthorities)
    .where(eq(contractingAuthorities.id, id));
  return row ?? null;
}

export async function lastImport(tx: TenantTx) {
  const [row] = await tx
    .select({
      status: importRuns.status,
      startedAt: importRuns.startedAt,
      finishedAt: importRuns.finishedAt,
      tendersCreated: importRuns.tendersCreated,
      tendersUpdated: importRuns.tendersUpdated,
      errorsCount: importRuns.errorsCount,
      message: importRuns.message,
    })
    .from(importRuns)
    .where(inArray(importRuns.status, ["succeeded", "partial", "failed"]))
    .orderBy(desc(importRuns.startedAt))
    .limit(1);
  return row ?? null;
}

// ----------------------------------------------------------------------------
// Services

export function searchTenderList(ctx: CompanyContext, search: TenderSearch) {
  return withTenant(ctx.user.id, async (tx) => ({
    ...(await searchTenders(tx, search)),
    authority: search.authority ? await authorityName(tx, search.authority) : null,
  }));
}

export async function getTender(ctx: CompanyContext, id: string) {
  const detail = await withTenant(ctx.user.id, (tx) => getTenderDetail(tx, id));
  if (!detail) throw new DomainError("NOT_FOUND");
  return detail;
}

export function findAuthorities(ctx: CompanyContext, q: string) {
  return withTenant(ctx.user.id, (tx) => searchAuthorities(tx, q));
}

export function getLastImport(ctx: CompanyContext) {
  return withTenant(ctx.user.id, (tx) => lastImport(tx));
}

/** Aggregates over public tender data for the landing page (no customer data). */
export async function getPublicStats() {
  const db = getDb();
  const [row] = await db
    .select({
      open: sql<number>`count(*) filter (where ${tenders.status} = 'open' and (${tenders.submissionDeadlineAt} is null or ${tenders.submissionDeadlineAt} > now()))`.mapWith(
        Number,
      ),
      authorities: sql<number>`count(distinct ${tenders.authorityId})`.mapWith(Number),
    })
    .from(tenders);
  const [run] = await db
    .select({ finishedAt: importRuns.finishedAt })
    .from(importRuns)
    .where(inArray(importRuns.status, ["succeeded", "partial"]))
    .orderBy(desc(importRuns.finishedAt))
    .limit(1);
  return {
    open: row?.open ?? 0,
    authorities: row?.authorities ?? 0,
    lastImportAt: run?.finishedAt ?? null,
  };
}
