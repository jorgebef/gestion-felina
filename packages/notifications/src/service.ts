/**
 * Digest notifications. Every (recipient, alert profile, tender) is delivered at most
 * once: the job first *claims* deliveries by inserting rows with a unique
 * `dedupe_key` (ON CONFLICT DO NOTHING), then sends one email per recipient and
 * company and records the outcome on those rows. Concurrent or repeated runs cannot
 * claim the same row twice, so no duplicate emails are sent.
 */
import { createHash } from "node:crypto";

import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

import {
  getDb,
  type Database,
  alertProfiles,
  companies,
  companyMembers,
  contractingAuthorities,
  notificationDeliveries,
  tenderMatches,
  tenders,
  users,
  type EmailFrequency,
} from "@licita/db";
import { ACTIONABLE_STATUSES } from "@licita/domain/tenders";

import { getMailer, MailerError, type Mailer } from "./mailer.ts";
import { digestEmail, type DigestSection, type DigestTender } from "./templates.ts";

export type DigestFrequency = Exclude<EmailFrequency, "off">;

const LOOKBACK_DAYS: Record<DigestFrequency, number> = { instant: 2, daily: 3, weekly: 14 };
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 60 * 60 * 1000;
const NEW_MATCH = "new_match";

export function newMatchDedupeKey(userId: string, profileId: string, tenderId: string): string {
  return `${NEW_MATCH}:email:${userId}:${profileId}:${tenderId}`;
}

interface Candidate {
  userId: string;
  email: string;
  companyId: string;
  companyName: string;
  profileId: string;
  profileName: string;
  tenderId: string;
}

async function findCandidates(
  db: Database,
  frequency: DigestFrequency,
  now: Date,
  companyId?: string,
): Promise<Candidate[]> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS[frequency] * 86_400_000);
  return db
    .select({
      userId: users.id,
      email: users.email,
      companyId: companies.id,
      companyName: sql<string>`coalesce(${companies.displayName}, ${companies.legalName})`,
      profileId: alertProfiles.id,
      profileName: alertProfiles.name,
      tenderId: tenderMatches.tenderId,
    })
    .from(tenderMatches)
    .innerJoin(alertProfiles, eq(alertProfiles.id, tenderMatches.alertProfileId))
    .innerJoin(companies, eq(companies.id, alertProfiles.companyId))
    .innerJoin(companyMembers, eq(companyMembers.companyId, companies.id))
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .innerJoin(tenders, eq(tenders.id, tenderMatches.tenderId))
    .where(
      and(
        eq(alertProfiles.isActive, true),
        eq(alertProfiles.emailFrequency, frequency),
        gt(tenderMatches.firstMatchedAt, since),
        or(isNull(tenderMatches.feedback), ne(tenderMatches.feedback, "irrelevant")),
        inArray(tenders.status, [...ACTIONABLE_STATUSES]),
        or(isNull(tenders.submissionDeadlineAt), gt(tenders.submissionDeadlineAt, now)),
        companyId ? eq(companies.id, companyId) : undefined,
      ),
    )
    .orderBy(desc(tenderMatches.score));
}

/** Claims new deliveries and re-queues retryable or abandoned ones. Returns claimed ids. */
async function claim(db: Database, candidates: Candidate[], now: Date): Promise<Set<string>> {
  const claimed = new Set<string>();
  for (let i = 0; i < candidates.length; i += 500) {
    const chunk = candidates.slice(i, i + 500);
    const rows = await db
      .insert(notificationDeliveries)
      .values(
        chunk.map((c) => ({
          userId: c.userId,
          companyId: c.companyId,
          alertProfileId: c.profileId,
          tenderId: c.tenderId,
          notificationType: NEW_MATCH,
          channel: "email" as const,
          dedupeKey: newMatchDedupeKey(c.userId, c.profileId, c.tenderId),
          status: "queued" as const,
          scheduledAt: now,
        })),
      )
      .onConflictDoNothing({ target: notificationDeliveries.dedupeKey })
      .returning({ id: notificationDeliveries.id });
    rows.forEach((r) => claimed.add(r.id));
  }

  const keys = candidates.map((c) => newMatchDedupeKey(c.userId, c.profileId, c.tenderId));
  for (let i = 0; i < keys.length; i += 500) {
    const retried = await db
      .update(notificationDeliveries)
      .set({ status: "queued", scheduledAt: now })
      .where(
        and(
          inArray(notificationDeliveries.dedupeKey, keys.slice(i, i + 500)),
          or(
            and(
              eq(notificationDeliveries.status, "failed"),
              lt(notificationDeliveries.attemptCount, MAX_ATTEMPTS),
            ),
            // Claimed by a run that died before sending.
            and(
              eq(notificationDeliveries.status, "queued"),
              lt(notificationDeliveries.scheduledAt, new Date(now.getTime() - STALE_CLAIM_MS)),
            ),
          ),
        ),
      )
      .returning({ id: notificationDeliveries.id });
    retried.forEach((r) => claimed.add(r.id));
  }
  return claimed;
}

async function loadDigestTenders(db: Database, deliveryIds: string[]) {
  return db
    .select({
      deliveryId: notificationDeliveries.id,
      profileId: notificationDeliveries.alertProfileId,
      profileName: alertProfiles.name,
      tenderId: tenders.id,
      title: tenders.title,
      authorityName: contractingAuthorities.name,
      score: tenderMatches.score,
      matchReason: tenderMatches.matchReason,
      baseBudgetExVatEur: tenders.baseBudgetExVatEur,
      submissionDeadlineAt: tenders.submissionDeadlineAt,
      executionProvinces: tenders.executionProvinces,
      officialUrl: tenders.primaryOfficialUrl,
    })
    .from(notificationDeliveries)
    .innerJoin(tenders, eq(tenders.id, notificationDeliveries.tenderId))
    .innerJoin(alertProfiles, eq(alertProfiles.id, notificationDeliveries.alertProfileId))
    .leftJoin(
      tenderMatches,
      and(
        eq(tenderMatches.alertProfileId, notificationDeliveries.alertProfileId),
        eq(tenderMatches.tenderId, notificationDeliveries.tenderId),
      ),
    )
    .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
    .where(inArray(notificationDeliveries.id, deliveryIds))
    .orderBy(asc(alertProfiles.name), desc(tenderMatches.score));
}

function toSections(rows: Awaited<ReturnType<typeof loadDigestTenders>>): DigestSection[] {
  const seen = new Set<string>();
  const sections = new Map<string, DigestSection>();
  for (const row of rows) {
    // A tender matching two profiles is listed once, under the first profile.
    if (seen.has(row.tenderId)) continue;
    seen.add(row.tenderId);
    const key = row.profileId ?? "";
    const section = sections.get(key) ?? { profileName: row.profileName, tenders: [] };
    const tender: DigestTender = {
      tenderId: row.tenderId,
      title: row.title,
      authorityName: row.authorityName,
      score: row.score ?? 0,
      baseBudgetExVatEur: row.baseBudgetExVatEur,
      submissionDeadlineAt: row.submissionDeadlineAt,
      executionProvinces: row.executionProvinces,
      officialUrl: row.officialUrl,
      firstReason: row.matchReason?.split("\n")[0],
    };
    section.tenders.push(tender);
    sections.set(key, section);
  }
  return [...sections.values()];
}

async function recordOutcome(
  db: Database,
  ids: string[],
  outcome: { ok: true; providerMessageId: string } | { ok: false; error: string; final: boolean },
  now: Date,
) {
  await db
    .update(notificationDeliveries)
    .set(
      outcome.ok
        ? {
            status: "sent",
            sentAt: now,
            providerMessageId: outcome.providerMessageId,
            errorMessage: null,
            attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
            lastAttemptAt: now,
          }
        : {
            status: "failed",
            errorMessage: outcome.error.slice(0, 1000),
            // Non-retryable errors exhaust the attempts so they are not retried.
            attemptCount: outcome.final
              ? MAX_ATTEMPTS
              : sql`${notificationDeliveries.attemptCount} + 1`,
            lastAttemptAt: now,
          },
    )
    .where(inArray(notificationDeliveries.id, ids));
}

export interface NotificationRunSummary {
  frequency: DigestFrequency;
  emailsSent: number;
  emailsFailed: number;
  deliveriesSent: number;
  deliveriesFailed: number;
}

export async function runDigest(
  frequency: DigestFrequency,
  {
    now = new Date(),
    db = getDb(),
    mailer = getMailer(),
    companyId,
  }: { now?: Date; db?: Database; mailer?: Mailer; companyId?: string } = {},
): Promise<NotificationRunSummary> {
  const summary: NotificationRunSummary = {
    frequency,
    emailsSent: 0,
    emailsFailed: 0,
    deliveriesSent: 0,
    deliveriesFailed: 0,
  };
  const candidates = await findCandidates(db, frequency, now, companyId);
  if (!candidates.length) return summary;
  const claimed = await claim(db, candidates, now);
  if (!claimed.size) return summary;

  // One email per recipient and company.
  const claimedRows = await db
    .select({
      id: notificationDeliveries.id,
      userId: notificationDeliveries.userId,
      companyId: notificationDeliveries.companyId,
    })
    .from(notificationDeliveries)
    .where(inArray(notificationDeliveries.id, [...claimed]));
  const groups = Map.groupBy(claimedRows, (r) => `${r.userId}|${r.companyId}`);
  const recipients = new Map(candidates.map((c) => [`${c.userId}|${c.companyId}`, c]));

  for (const [key, rows] of groups) {
    const recipient = recipients.get(key);
    const ids = rows.map((r) => r.id);
    if (!recipient) continue;
    const sections = toSections(await loadDigestTenders(db, ids));
    const label = { instant: "Nuevas", daily: "Resumen diario", weekly: "Resumen semanal" }[
      frequency
    ];
    const message = digestEmail({
      to: recipient.email,
      heading: `${label}: oportunidades para ${recipient.companyName}`,
      intro:
        "Estas licitaciones públicas encajan con tus perfiles de alertas. Revisa los plazos y la documentación en el expediente oficial.",
      sections,
    });
    try {
      const result = await mailer.send({
        ...message,
        idempotencyKey: createHash("sha256").update(ids.toSorted().join(",")).digest("hex"),
      });
      await recordOutcome(db, ids, { ok: true, providerMessageId: result.providerMessageId }, now);
      summary.emailsSent++;
      summary.deliveriesSent += ids.length;
    } catch (error) {
      const retryable = error instanceof MailerError ? error.retryable : true;
      await recordOutcome(
        db,
        ids,
        { ok: false, error: (error as Error).message, final: !retryable },
        now,
      );
      summary.emailsFailed++;
      summary.deliveriesFailed += ids.length;
    }
  }
  return summary;
}

/**
 * Sends the current top matches of a company to one user, on demand. Logged as a
 * `test` delivery (at most one per minute) and does not mark matches as notified.
 */
export async function sendTestNotification(
  { userId, companyId }: { userId: string; companyId: string },
  {
    now = new Date(),
    db = getDb(),
    mailer = getMailer(),
  }: { now?: Date; db?: Database; mailer?: Mailer } = {},
): Promise<{ status: "sent" | "failed" | "throttled"; error?: string; tenders: number }> {
  const [recipient] = await db
    .select({
      email: users.email,
      companyName: sql<string>`coalesce(${companies.displayName}, ${companies.legalName})`,
    })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId)))
    .limit(1);
  if (!recipient) throw new Error("FORBIDDEN");

  const minute = now.toISOString().slice(0, 16);
  const [delivery] = await db
    .insert(notificationDeliveries)
    .values({
      userId,
      companyId,
      notificationType: "test",
      channel: "email",
      dedupeKey: `test:email:${userId}:${companyId}:${minute}`,
      status: "queued",
      scheduledAt: now,
    })
    .onConflictDoNothing({ target: notificationDeliveries.dedupeKey })
    .returning({ id: notificationDeliveries.id });
  if (!delivery) return { status: "throttled", tenders: 0 };

  const top = await db
    .select({
      profileId: alertProfiles.id,
      profileName: alertProfiles.name,
      tenderId: tenders.id,
      title: tenders.title,
      authorityName: contractingAuthorities.name,
      score: tenderMatches.score,
      matchReason: tenderMatches.matchReason,
      baseBudgetExVatEur: tenders.baseBudgetExVatEur,
      submissionDeadlineAt: tenders.submissionDeadlineAt,
      executionProvinces: tenders.executionProvinces,
      officialUrl: tenders.primaryOfficialUrl,
    })
    .from(tenderMatches)
    .innerJoin(alertProfiles, eq(alertProfiles.id, tenderMatches.alertProfileId))
    .innerJoin(tenders, eq(tenders.id, tenderMatches.tenderId))
    .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
    .where(
      and(
        eq(alertProfiles.companyId, companyId),
        inArray(tenders.status, [...ACTIONABLE_STATUSES]),
        or(isNull(tenders.submissionDeadlineAt), gt(tenders.submissionDeadlineAt, now)),
      ),
    )
    .orderBy(desc(tenderMatches.score))
    .limit(5);

  const sections = toSections(top.map((t) => ({ ...t, deliveryId: delivery.id })));
  const message = digestEmail({
    to: recipient.email,
    heading: "Correo de prueba",
    intro: top.length
      ? "Así recibirás tus avisos. Estas son tus oportunidades abiertas con mayor relevancia ahora mismo."
      : "Así recibirás tus avisos. Todavía no hay licitaciones abiertas que encajen con tus perfiles.",
    sections,
    subjectPrefix: "Prueba",
  });
  try {
    const result = await mailer.send({ ...message, idempotencyKey: delivery.id });
    await recordOutcome(
      db,
      [delivery.id],
      { ok: true, providerMessageId: result.providerMessageId },
      now,
    );
    return { status: "sent", tenders: top.length };
  } catch (error) {
    await recordOutcome(
      db,
      [delivery.id],
      { ok: false, error: (error as Error).message, final: true },
      now,
    );
    return { status: "failed", error: (error as Error).message, tenders: top.length };
  }
}
