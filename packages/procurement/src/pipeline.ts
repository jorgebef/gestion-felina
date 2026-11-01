/**
 * Persists normalized records from any connector. Guarantees:
 *  - one `tenders` row per (source_platform, external_record_id) — re-imports update it;
 *  - a record older than (or as old as) what is stored is skipped, so runs are idempotent;
 *  - notices become `tender_events` once (unique per source + external_notice_id);
 *  - relevant field changes (status, deadline, budget…) are recorded as events;
 *  - a failing record is logged in `import_runs.errors` without stopping the run.
 */
import { createHash } from "node:crypto";

import { and, desc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";

import {
  contractingAuthorities,
  getDb,
  importRunPages,
  importRuns,
  tenderEvents,
  tenderLots,
  tenderSources,
  tenders,
  type Database,
  type ImportError,
  type JsonObject,
} from "@licita/db";

import type {
  DeletedRecord,
  NormalizedAuthority,
  NormalizedTenderRecord,
  RawArchive,
  RawDocument,
  SourceConnector,
} from "./types.ts";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const MAX_STORED_ERRORS = 50;
const MAX_RAW_PAYLOAD_BYTES = 256 * 1024;
const STALE_RUN_MS = 2 * 60 * 60 * 1000;

export type RecordOutcome = "created" | "updated" | "unchanged";

export interface RecordResult {
  outcome: RecordOutcome;
  tenderId: string;
  eventsCreated: number;
}

// ----------------------------------------------------------------------------
// Authorities

async function upsertAuthority(tx: Tx, authority: NormalizedAuthority): Promise<string> {
  const values = {
    name: authority.name,
    placspAuthorityId: authority.platformId ?? null,
    taxId: authority.taxId ?? null,
    administrationType: authority.administrationType ?? null,
    provinceCode: authority.provinceCode ?? null,
    municipality: authority.municipality ?? null,
    profileUrl: authority.profileUrl ?? null,
  };
  if (authority.platformId) {
    const [row] = await tx
      .insert(contractingAuthorities)
      .values(values)
      .onConflictDoUpdate({
        target: contractingAuthorities.placspAuthorityId,
        targetWhere: sql`placsp_authority_id IS NOT NULL`,
        set: {
          name: values.name,
          taxId: values.taxId,
          administrationType: values.administrationType,
          provinceCode: values.provinceCode,
          municipality: values.municipality,
          profileUrl: values.profileUrl,
        },
      })
      .returning({ id: contractingAuthorities.id });
    return row!.id;
  }
  const existing = await tx
    .select({ id: contractingAuthorities.id })
    .from(contractingAuthorities)
    .where(
      and(
        eq(contractingAuthorities.name, authority.name),
        authority.taxId
          ? eq(contractingAuthorities.taxId, authority.taxId)
          : sql`${contractingAuthorities.taxId} IS NULL`,
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await tx
    .insert(contractingAuthorities)
    .values(values)
    .returning({ id: contractingAuthorities.id });
  return row!.id;
}

// ----------------------------------------------------------------------------
// Change detection

type TenderRow = typeof tenders.$inferSelect;

const TRACKED_FIELDS = [
  ["status", "Estado"],
  ["submissionDeadlineAt", "Fecha límite de presentación"],
  ["baseBudgetExVatEur", "Presupuesto base sin IVA"],
  ["estimatedValueEur", "Valor estimado"],
  ["title", "Título"],
] as const;

function comparable(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "string") return String(value);
  return JSON.stringify(value);
}

export function detectChanges(
  current: Pick<TenderRow, (typeof TRACKED_FIELDS)[number][0]>,
  next: NormalizedTenderRecord,
): Record<string, { label: string; from: string | null; to: string | null }> {
  const changes: Record<string, { label: string; from: string | null; to: string | null }> = {};
  for (const [field, label] of TRACKED_FIELDS) {
    const from = comparable(current[field]);
    const to = comparable(next[field]);
    if (from !== to) changes[field] = { label, from, to };
  }
  return changes;
}

// ----------------------------------------------------------------------------
// Records

function tenderValues(record: NormalizedTenderRecord, authorityId: string | null, now: Date) {
  return {
    authorityId,
    expedienteNumber: record.expedienteNumber ?? null,
    title: record.title,
    description: record.description ?? null,
    contractType: record.contractType ?? null,
    procedureType: record.procedureType ?? null,
    status: record.status,
    mainCpvCode: record.mainCpvCode ?? null,
    cpvCodes: record.cpvCodes,
    executionProvinces: record.executionProvinces,
    executionMunicipality: record.executionMunicipality ?? null,
    baseBudgetExVatEur: record.baseBudgetExVatEur ?? null,
    estimatedValueEur: record.estimatedValueEur ?? null,
    firstPublishedAt: record.firstPublishedAt ?? null,
    submissionDeadlineAt: record.submissionDeadlineAt ?? null,
    primaryOfficialUrl: record.officialUrl,
    rawSummary: { ...record.summary, executionScope: record.executionScope },
    lastSeenAt: now,
    updatedAt: now,
  };
}

function boundedPayload(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  return json.length > MAX_RAW_PAYLOAD_BYTES
    ? { truncated: true, bytes: json.length, note: "Payload too large; re-fetch from source." }
    : payload;
}

async function replaceLots(tx: Tx, tenderId: string, record: NormalizedTenderRecord) {
  const codes = record.lots.map((l) => l.sourceLotCode);
  await tx
    .delete(tenderLots)
    .where(
      codes.length
        ? and(eq(tenderLots.tenderId, tenderId), notInArray(tenderLots.sourceLotCode, codes))
        : eq(tenderLots.tenderId, tenderId),
    );
  for (const lot of record.lots) {
    const values = {
      title: lot.title ?? null,
      cpvCodes: lot.cpvCodes,
      executionProvinces: lot.executionProvinces,
      baseBudgetExVatEur: lot.baseBudgetExVatEur ?? null,
      estimatedValueEur: lot.estimatedValueEur ?? null,
      submissionDeadlineAt: record.submissionDeadlineAt ?? null,
    };
    await tx
      .insert(tenderLots)
      .values({ tenderId, sourceLotCode: lot.sourceLotCode, ...values })
      .onConflictDoUpdate({ target: [tenderLots.tenderId, tenderLots.sourceLotCode], set: values });
  }
}

interface EventInput {
  externalNoticeId: string;
  eventType: string;
  headline: string;
  details?: string;
  effectiveAt?: Date;
  payload: JsonObject;
}

async function insertEvents(
  tx: Tx,
  tenderId: string,
  sourceId: string,
  officialUrl: string,
  events: EventInput[],
): Promise<number> {
  if (!events.length) return 0;
  const inserted = await tx
    .insert(tenderEvents)
    .values(
      events.map((e) => ({
        tenderId,
        tenderSourceId: sourceId,
        externalNoticeId: e.externalNoticeId,
        eventType: e.eventType,
        headline: e.headline,
        details: e.details ?? null,
        effectiveAt: e.effectiveAt ?? null,
        officialUrl,
        payload: e.payload,
      })),
    )
    .onConflictDoNothing({
      target: [tenderEvents.tenderSourceId, tenderEvents.externalNoticeId],
      where: sql`tender_source_id IS NOT NULL AND external_notice_id IS NOT NULL`,
    })
    .returning({ id: tenderEvents.id });
  return inserted.length;
}

export async function upsertRecord(
  db: Database,
  record: NormalizedTenderRecord,
  now = new Date(),
): Promise<RecordResult> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(tenderSources)
      .where(
        and(
          eq(tenderSources.sourcePlatform, record.sourcePlatform),
          eq(tenderSources.externalRecordId, record.externalRecordId),
        ),
      )
      .for("update")
      .limit(1);

    if (source && source.sourceUpdatedAt && source.sourceUpdatedAt >= record.sourceUpdatedAt) {
      await tx
        .update(tenderSources)
        .set({ lastSeenAt: now })
        .where(eq(tenderSources.id, source.id));
      await tx.update(tenders).set({ lastSeenAt: now }).where(eq(tenders.id, source.tenderId));
      return { outcome: "unchanged", tenderId: source.tenderId, eventsCreated: 0 };
    }

    const authorityId = record.authority ? await upsertAuthority(tx, record.authority) : null;
    const values = tenderValues(record, authorityId, now);
    const noticeEvents: EventInput[] = record.notices.map((n) => ({ ...n }));

    if (!source) {
      const [tender] = await tx
        .insert(tenders)
        .values({ ...values, firstSeenAt: now })
        .returning({ id: tenders.id });
      const [created] = await tx
        .insert(tenderSources)
        .values({
          tenderId: tender!.id,
          sourcePlatform: record.sourcePlatform,
          externalRecordId: record.externalRecordId,
          officialUrl: record.officialUrl,
          sourceUpdatedAt: record.sourceUpdatedAt,
          firstSeenAt: now,
          lastSeenAt: now,
          rawPayload: boundedPayload(record.rawPayload),
        })
        .returning({ id: tenderSources.id });
      await replaceLots(tx, tender!.id, record);
      const eventsCreated = await insertEvents(
        tx,
        tender!.id,
        created!.id,
        record.officialUrl,
        noticeEvents,
      );
      return { outcome: "created", tenderId: tender!.id, eventsCreated };
    }

    const [current] = await tx
      .select()
      .from(tenders)
      .where(eq(tenders.id, source.tenderId))
      .limit(1);
    const changes = current ? detectChanges(current, record) : {};
    const changeEvents: EventInput[] = [];
    if (changes.status) {
      changeEvents.push({
        externalNoticeId: `status|${record.status}|${record.sourceUpdatedAt.toISOString()}`,
        eventType: "status_change",
        headline: "Cambio de estado",
        effectiveAt: record.sourceUpdatedAt,
        payload: { from: changes.status.from, to: changes.status.to },
      });
    }
    const otherChanges = Object.fromEntries(
      Object.entries(changes).filter(([field]) => field !== "status"),
    );
    if (Object.keys(otherChanges).length) {
      changeEvents.push({
        externalNoticeId: `change|${record.sourceUpdatedAt.toISOString()}`,
        eventType: "change_detected",
        headline: `Cambios en: ${Object.values(otherChanges)
          .map((c) => c.label.toLowerCase())
          .join(", ")}`,
        effectiveAt: record.sourceUpdatedAt,
        payload: { changes: otherChanges },
      });
    }

    await tx.update(tenders).set(values).where(eq(tenders.id, source.tenderId));
    await tx
      .update(tenderSources)
      .set({
        officialUrl: record.officialUrl,
        sourceUpdatedAt: record.sourceUpdatedAt,
        lastSeenAt: now,
        rawPayload: boundedPayload(record.rawPayload),
      })
      .where(eq(tenderSources.id, source.id));
    await replaceLots(tx, source.tenderId, record);
    const eventsCreated = await insertEvents(tx, source.tenderId, source.id, record.officialUrl, [
      ...noticeEvents,
      ...changeEvents,
    ]);
    return { outcome: "updated", tenderId: source.tenderId, eventsCreated };
  });
}

/** Tombstone: the source withdrew the record. The tender is kept and marked cancelled. */
export async function applyDeletion(
  db: Database,
  deletion: DeletedRecord,
): Promise<{ tenderId: string; eventsCreated: number } | undefined> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(tenderSources)
      .where(
        and(
          eq(tenderSources.sourcePlatform, deletion.sourcePlatform),
          eq(tenderSources.externalRecordId, deletion.externalRecordId),
        ),
      )
      .limit(1);
    if (!source) return undefined;
    const eventsCreated = await insertEvents(tx, source.tenderId, source.id, source.officialUrl, [
      {
        externalNoticeId: `deleted|${deletion.deletedAt.toISOString()}`,
        eventType: "removed_from_source",
        headline: "Retirada de la fuente oficial",
        details: deletion.reason ? `Motivo indicado por la fuente: ${deletion.reason}` : undefined,
        effectiveAt: deletion.deletedAt,
        payload: { reason: deletion.reason ?? null },
      },
    ]);
    if (eventsCreated) {
      await tx
        .update(tenders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(tenders.id, source.tenderId));
    }
    return { tenderId: source.tenderId, eventsCreated };
  });
}

// ----------------------------------------------------------------------------
// Runs

export interface ImportOptions {
  maxPages: number;
  triggeredBy?: string;
  /** Ignore the previous high-water mark and walk `maxPages` pages from the top. */
  full?: boolean;
  startUrl?: string;
  /** When set, every fetched page is stored as-is (see `archivePage`). */
  archive?: RawArchive;
  log?: (message: string) => void;
}

export interface ImportSummary {
  runId: string;
  status: "succeeded" | "partial" | "failed";
  pagesFetched: number;
  entriesSeen: number;
  created: number;
  updated: number;
  unchanged: number;
  eventsCreated: number;
  errorsCount: number;
  /** Tenders created or updated in this run (input for incremental matching). */
  changedTenderIds: string[];
  message?: string;
}

/** `raw/<connector>/<yyyy>/<mm>/<dd>/<run id>/<page>.<ext>` (UTC date of the run). */
export function rawPageKey(
  connector: string,
  runId: string,
  startedAt: Date,
  page: number,
  extension: string,
) {
  const day = startedAt.toISOString().slice(0, 10).replaceAll("-", "/");
  return `raw/${connector}/${day}/${runId}/${String(page).padStart(4, "0")}.${extension}`;
}

/**
 * Records the page in `import_run_pages` (URL, SHA-256 and size of the document) and,
 * when an archive is configured, stores the raw document so any import can be audited
 * or re-parsed later without fetching the source again.
 */
async function archivePage(
  db: Database,
  input: {
    connector: string;
    runId: string;
    startedAt: Date;
    pageNumber: number;
    url: string;
    raw: RawDocument;
    archive?: RawArchive;
  },
): Promise<void> {
  const { raw } = input;
  let storageKey: string | null = null;
  let archiveError: unknown;
  if (input.archive) {
    const key = rawPageKey(
      input.connector,
      input.runId,
      input.startedAt,
      input.pageNumber,
      raw.extension,
    );
    try {
      await input.archive.put({ key, body: raw.body, contentType: raw.contentType });
      storageKey = key;
    } catch (error) {
      archiveError = error;
    }
  }
  await db.insert(importRunPages).values({
    importRunId: input.runId,
    pageNumber: input.pageNumber,
    sourceUrl: input.url,
    contentSha256: createHash("sha256").update(raw.body).digest("hex"),
    byteSize: Buffer.byteLength(raw.body),
    storageKey,
  });
  if (archiveError) throw archiveError;
}

async function previousHighWaterMark(db: Database, connector: string): Promise<Date | undefined> {
  const [row] = await db
    .select({ hwm: importRuns.highWaterMark })
    .from(importRuns)
    .where(
      and(
        eq(importRuns.connector, connector),
        inArray(importRuns.status, ["succeeded", "partial"]),
        sql`${importRuns.highWaterMark} IS NOT NULL`,
      ),
    )
    .orderBy(desc(importRuns.highWaterMark))
    .limit(1);
  return row?.hwm ?? undefined;
}

export async function runImport(
  connector: SourceConnector,
  options: ImportOptions,
  db: Database = getDb(),
): Promise<ImportSummary> {
  const log = options.log ?? (() => {});

  // Guard against overlapping runs; runs stuck for hours are considered dead.
  await db
    .update(importRuns)
    .set({ status: "failed", finishedAt: new Date(), message: "Ejecución abandonada" })
    .where(
      and(
        eq(importRuns.connector, connector.id),
        eq(importRuns.status, "running"),
        lt(importRuns.startedAt, new Date(Date.now() - STALE_RUN_MS)),
      ),
    );
  const [running] = await db
    .select({ id: importRuns.id })
    .from(importRuns)
    .where(and(eq(importRuns.connector, connector.id), eq(importRuns.status, "running")))
    .limit(1);
  if (running) throw new Error(`Ya hay una importación en curso (${running.id})`);

  const since = options.full ? undefined : await previousHighWaterMark(db, connector.id);
  const [run] = await db
    .insert(importRuns)
    .values({
      connector: connector.id,
      sourceUrl: options.startUrl ?? connector.defaultUrl,
      triggeredBy: options.triggeredBy ?? "cli",
    })
    .returning({ id: importRuns.id, startedAt: importRuns.startedAt });
  const runId = run!.id;
  const startedAt = run!.startedAt;

  const summary: ImportSummary = {
    runId,
    status: "succeeded",
    pagesFetched: 0,
    entriesSeen: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    eventsCreated: 0,
    errorsCount: 0,
    changedTenderIds: [],
  };
  const errors: ImportError[] = [];
  const changed = new Set<string>();
  let newest: Date | undefined;
  let reachedSince = !since;
  let fatal: Error | undefined;

  const recordError = (error: ImportError) => {
    summary.errorsCount++;
    if (errors.length < MAX_STORED_ERRORS) errors.push(error);
  };

  const saveProgress = () =>
    db
      .update(importRuns)
      .set({
        pagesFetched: summary.pagesFetched,
        entriesSeen: summary.entriesSeen,
        tendersCreated: summary.created,
        tendersUpdated: summary.updated,
        tendersUnchanged: summary.unchanged,
        eventsCreated: summary.eventsCreated,
        errorsCount: summary.errorsCount,
        errors,
      })
      .where(eq(importRuns.id, runId));

  try {
    for await (const page of connector.pages({
      since,
      maxPages: options.maxPages,
      startUrl: options.startUrl,
    })) {
      summary.pagesFetched++;
      summary.entriesSeen += page.records.length;
      if (page.raw) {
        try {
          await archivePage(db, {
            connector: connector.id,
            runId,
            startedAt,
            pageNumber: summary.pagesFetched,
            url: page.url,
            raw: page.raw,
            archive: options.archive,
          });
        } catch (error) {
          // Losing the archived copy must not lose the data itself.
          recordError({
            message: `No se pudo archivar la página ${summary.pagesFetched}: ${(error as Error).message}`,
          });
        }
      }
      page.errors.forEach(recordError);
      if (page.newestUpdatedAt && (!newest || page.newestUpdatedAt > newest)) {
        newest = page.newestUpdatedAt;
      }
      if (since && page.oldestUpdatedAt && page.oldestUpdatedAt <= since) reachedSince = true;

      // Oldest first, so that if a page repeats a record the newest version wins.
      const records = page.records.toSorted(
        (a, b) => a.sourceUpdatedAt.getTime() - b.sourceUpdatedAt.getTime(),
      );
      for (const record of records) {
        try {
          const result = await upsertRecord(db, record);
          summary[result.outcome]++;
          summary.eventsCreated += result.eventsCreated;
          if (result.outcome !== "unchanged") changed.add(result.tenderId);
        } catch (error) {
          recordError({
            externalRecordId: record.externalRecordId,
            message: (error as Error).message,
          });
        }
      }
      for (const deletion of page.deletions) {
        try {
          const result = await applyDeletion(db, deletion);
          if (result?.eventsCreated) {
            summary.eventsCreated += result.eventsCreated;
            changed.add(result.tenderId);
          }
        } catch (error) {
          recordError({
            externalRecordId: deletion.externalRecordId,
            message: (error as Error).message,
          });
        }
      }
      log(
        `página ${summary.pagesFetched}: ${page.records.length} registros · ` +
          `${summary.created} nuevos, ${summary.updated} actualizados, ${summary.errorsCount} errores`,
      );
      await saveProgress();
    }
  } catch (error) {
    fatal = error as Error;
    recordError({ message: `Error de la fuente: ${fatal.message}` });
  }

  const messages: string[] = [];
  if (fatal) messages.push(`Importación interrumpida: ${fatal.message}`);
  if (!fatal && !reachedSince) {
    messages.push(
      `Se alcanzó el límite de ${options.maxPages} páginas antes de enlazar con la importación anterior.`,
    );
  }
  if (!since && !fatal) {
    messages.push(
      options.full
        ? `Reimportación completa de ${summary.pagesFetched} páginas del feed.`
        : `Carga inicial: últimas ${summary.pagesFetched} páginas del feed.`,
    );
  }

  summary.status =
    fatal && summary.pagesFetched === 0
      ? "failed"
      : fatal || summary.errorsCount > 0 || (since && !reachedSince)
        ? "partial"
        : "succeeded";
  summary.changedTenderIds = [...changed];
  summary.message = messages.join(" ") || undefined;

  // The mark only advances when every page down to the previous mark was processed.
  const highWaterMark = !fatal && newest ? newest : (since ?? null);
  await saveProgress();
  await db
    .update(importRuns)
    .set({
      status: summary.status,
      finishedAt: new Date(),
      highWaterMark,
      message: summary.message ?? null,
    })
    .where(eq(importRuns.id, runId));
  return summary;
}
