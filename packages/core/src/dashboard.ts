/** Dashboard, match lists and the user's email history. */
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import {
  alertProfiles,
  contractingAuthorities,
  notificationDeliveries,
  tenderMatches,
  tenders,
  trackedTenders,
  withTenant,
  type TenantTx,
} from "@licita/db";

import { ACTIONABLE_STATUSES } from "@licita/domain/tenders";
import { sendTestNotification } from "@licita/notifications/service";
import type { MatchListQuery } from "@licita/schemas/matches";

import type { CompanyContext } from "./context.ts";
import { upcomingTasks } from "./tasks.ts";
import { lastImport } from "./tenders.ts";

const DAY = 86_400_000;
const MATCH_PAGE_SIZE = 20;

function actionable(now: Date) {
  return and(
    inArray(tenders.status, [...ACTIONABLE_STATUSES]),
    or(isNull(tenders.submissionDeadlineAt), gte(tenders.submissionDeadlineAt, now)),
  );
}

const notDismissed = or(isNull(tenderMatches.feedback), ne(tenderMatches.feedback, "irrelevant"));

function matchQuery(tx: TenantTx, companyId: string) {
  return tx
    .select({
      matchId: tenderMatches.id,
      score: tenderMatches.score,
      matchReason: tenderMatches.matchReason,
      matchedLotCodes: tenderMatches.matchedLotCodes,
      feedback: tenderMatches.feedback,
      firstMatchedAt: tenderMatches.firstMatchedAt,
      profileId: alertProfiles.id,
      profileName: alertProfiles.name,
      tenderId: tenders.id,
      title: tenders.title,
      status: tenders.status,
      contractType: tenders.contractType,
      executionProvinces: tenders.executionProvinces,
      baseBudgetExVatEur: tenders.baseBudgetExVatEur,
      submissionDeadlineAt: tenders.submissionDeadlineAt,
      firstPublishedAt: tenders.firstPublishedAt,
      authorityName: contractingAuthorities.name,
      trackedStatus: trackedTenders.workflowStatus,
    })
    .from(tenderMatches)
    .innerJoin(alertProfiles, eq(alertProfiles.id, tenderMatches.alertProfileId))
    .innerJoin(tenders, eq(tenders.id, tenderMatches.tenderId))
    .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
    .leftJoin(
      trackedTenders,
      and(eq(trackedTenders.tenderId, tenders.id), eq(trackedTenders.companyId, companyId)),
    )
    .$dynamic();
}

export function getDashboard(ctx: CompanyContext) {
  return withTenant(ctx.user.id, async (tx) => {
    const now = new Date();
    const companyId = ctx.company.id;
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const inTwoWeeks = new Date(now.getTime() + 14 * DAY);
    const ofCompany = eq(alertProfiles.companyId, companyId);

    const [stats] = await tx
      .select({
        activeOpportunities: sql<number>`count(distinct ${tenderMatches.tenderId})`.mapWith(Number),
        newThisWeek:
          sql<number>`count(distinct ${tenderMatches.tenderId}) filter (where ${tenderMatches.firstMatchedAt} >= ${weekAgo})`.mapWith(
            Number,
          ),
      })
      .from(tenderMatches)
      .innerJoin(alertProfiles, eq(alertProfiles.id, tenderMatches.alertProfileId))
      .innerJoin(tenders, eq(tenders.id, tenderMatches.tenderId))
      .where(and(ofCompany, actionable(now), notDismissed));

    const [tracking] = await tx
      .select({
        saved:
          sql<number>`count(*) filter (where ${trackedTenders.workflowStatus} <> 'archived')`.mapWith(
            Number,
          ),
        dueSoon:
          sql<number>`count(*) filter (where ${trackedTenders.workflowStatus} in ('saved','evaluating','preparing') and ${tenders.submissionDeadlineAt} between ${now} and ${inTwoWeeks})`.mapWith(
            Number,
          ),
      })
      .from(trackedTenders)
      .innerJoin(tenders, eq(tenders.id, trackedTenders.tenderId))
      .where(eq(trackedTenders.companyId, companyId));

    const [profiles] = await tx
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${alertProfiles.isActive})`.mapWith(Number),
      })
      .from(alertProfiles)
      .where(ofCompany);

    const newMatches = await matchQuery(tx, companyId)
      .where(and(ofCompany, actionable(now), notDismissed))
      .orderBy(
        desc(sql`date_trunc('day', ${tenderMatches.firstMatchedAt})`),
        desc(tenderMatches.score),
      )
      .limit(8);

    const deadlines = await tx
      .select({
        tenderId: tenders.id,
        title: tenders.title,
        submissionDeadlineAt: tenders.submissionDeadlineAt,
        workflowStatus: trackedTenders.workflowStatus,
      })
      .from(trackedTenders)
      .innerJoin(tenders, eq(tenders.id, trackedTenders.tenderId))
      .where(
        and(
          eq(trackedTenders.companyId, companyId),
          inArray(trackedTenders.workflowStatus, ["saved", "evaluating", "preparing"]),
          gte(tenders.submissionDeadlineAt, now),
        ),
      )
      .orderBy(tenders.submissionDeadlineAt)
      .limit(6);

    const alerts = await tx
      .select({
        providerMessageId: notificationDeliveries.providerMessageId,
        notificationType: notificationDeliveries.notificationType,
        status: notificationDeliveries.status,
        at: sql<Date>`max(coalesce(${notificationDeliveries.sentAt}, ${notificationDeliveries.lastAttemptAt}, ${notificationDeliveries.scheduledAt}))`.mapWith(
          (v) => new Date(v),
        ),
        tenders: sql<number>`count(${notificationDeliveries.tenderId})`.mapWith(Number),
        error: sql<string | null>`max(${notificationDeliveries.errorMessage})`,
      })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.userId, ctx.user.id),
          eq(notificationDeliveries.companyId, companyId),
        ),
      )
      .groupBy(
        notificationDeliveries.providerMessageId,
        notificationDeliveries.notificationType,
        notificationDeliveries.status,
        sql`case when ${notificationDeliveries.providerMessageId} is null then ${notificationDeliveries.id} end`,
      )
      .orderBy(desc(sql`4`))
      .limit(5);

    return {
      stats: {
        activeOpportunities: stats?.activeOpportunities ?? 0,
        newThisWeek: stats?.newThisWeek ?? 0,
        saved: tracking?.saved ?? 0,
        dueSoon: tracking?.dueSoon ?? 0,
      },
      profiles: profiles ?? { total: 0, active: 0 },
      newMatches,
      deadlines,
      tasks: await upcomingTasks(tx, companyId, 6),
      alerts,
      lastImport: await lastImport(tx),
    };
  });
}

export function listMatches(ctx: CompanyContext, data: MatchListQuery) {
  return withTenant(ctx.user.id, async (tx) => {
    const now = new Date();
    const page = data.page ?? 1;
    const view = data.view ?? "active";
    const where = and(
      eq(alertProfiles.companyId, ctx.company.id),
      data.profile ? eq(alertProfiles.id, data.profile) : undefined,
      view === "dismissed" ? eq(tenderMatches.feedback, "irrelevant") : notDismissed,
      view === "relevant" ? eq(tenderMatches.feedback, "relevant") : undefined,
      view === "new"
        ? gte(tenderMatches.firstMatchedAt, new Date(now.getTime() - 7 * DAY))
        : undefined,
      view === "dismissed" ? undefined : actionable(now),
    );
    const items = await matchQuery(tx, ctx.company.id)
      .where(where)
      .orderBy(desc(tenderMatches.score), desc(tenderMatches.firstMatchedAt))
      .limit(MATCH_PAGE_SIZE)
      .offset((page - 1) * MATCH_PAGE_SIZE);
    const [{ total }] = (await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(tenderMatches)
      .innerJoin(alertProfiles, eq(alertProfiles.id, tenderMatches.alertProfileId))
      .innerJoin(tenders, eq(tenders.id, tenderMatches.tenderId))
      .where(where)) as [{ total: number }];
    const profiles = await tx
      .select({ id: alertProfiles.id, name: alertProfiles.name })
      .from(alertProfiles)
      .where(eq(alertProfiles.companyId, ctx.company.id))
      .orderBy(alertProfiles.name);
    return {
      items,
      total,
      page,
      pageCount: Math.ceil(total / MATCH_PAGE_SIZE),
      profiles,
    };
  });
}

export function sendTestEmail(ctx: CompanyContext) {
  return sendTestNotification({ userId: ctx.user.id, companyId: ctx.company.id });
}

/** Most recent sent emails for the settings page. */
export function listMyDeliveries(ctx: CompanyContext) {
  return withTenant(ctx.user.id, (tx) =>
    tx
      .select({
        id: notificationDeliveries.id,
        notificationType: notificationDeliveries.notificationType,
        status: notificationDeliveries.status,
        sentAt: notificationDeliveries.sentAt,
        scheduledAt: notificationDeliveries.scheduledAt,
        errorMessage: notificationDeliveries.errorMessage,
      })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.userId, ctx.user.id),
          eq(notificationDeliveries.companyId, ctx.company.id),
          lte(notificationDeliveries.scheduledAt, new Date()),
        ),
      )
      .orderBy(desc(notificationDeliveries.scheduledAt))
      .limit(20),
  );
}
