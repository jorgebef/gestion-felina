/**
 * Daily reminders: each participant receives one email listing the actions they take
 * part in that are scheduled for today (Europe/Madrid) and not done or cancelled.
 * `notification_deliveries.dedupe_key` (user + day) makes the job safe to re-run.
 */
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import {
  actionParticipants,
  actions,
  colonies,
  getDb,
  notificationDeliveries,
  users,
} from "@felina/db";

import { madridDayBounds } from "@felina/domain/time";

import { getMailer, MailerError } from "./mailer.ts";
import { actionRemindersEmail, type ReminderAction } from "./templates.ts";

const MAX_ATTEMPTS = 3;

export interface ReminderSummary {
  day: string;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runActionReminders(now = new Date()): Promise<ReminderSummary> {
  const db = getDb();
  const { start, end, key } = madridDayBounds(now);
  const rows = await db
    .select({
      userId: actionParticipants.userId,
      email: users.email,
      id: actions.id,
      name: actions.name,
      actionType: actions.actionType,
      scheduledAt: actions.scheduledAt,
      isUrgent: actions.isUrgent,
      colonyName: colonies.name,
    })
    .from(actionParticipants)
    .innerJoin(actions, eq(actions.id, actionParticipants.actionId))
    .innerJoin(users, eq(users.id, actionParticipants.userId))
    .leftJoin(colonies, eq(colonies.id, actions.colonyId))
    .where(
      and(
        gte(actions.scheduledAt, start),
        lt(actions.scheduledAt, end),
        inArray(actions.status, ["planned", "in_progress"]),
      ),
    )
    .orderBy(actions.scheduledAt);

  const byUser = new Map<string, { email: string; actions: ReminderAction[] }>();
  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? { email: row.email, actions: [] };
    entry.actions.push(row);
    byUser.set(row.userId, entry);
  }

  const summary: ReminderSummary = {
    day: key,
    recipients: byUser.size,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  const mailer = getMailer();
  for (const [userId, entry] of byUser) {
    const dedupeKey = `action-reminders:${userId}:${key}`;
    await db
      .insert(notificationDeliveries)
      .values({ userId, notificationType: "action_reminders", dedupeKey })
      .onConflictDoNothing({ target: notificationDeliveries.dedupeKey });
    // Claim the row: only queued (or retryable failed) deliveries are attempted.
    const [claimed] = await db
      .update(notificationDeliveries)
      .set({ attemptCount: sql`${notificationDeliveries.attemptCount} + 1` })
      .where(
        and(
          eq(notificationDeliveries.dedupeKey, dedupeKey),
          sql`${notificationDeliveries.status} <> 'sent'`,
          lt(notificationDeliveries.attemptCount, MAX_ATTEMPTS),
        ),
      )
      .returning({ id: notificationDeliveries.id });
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }
    try {
      const result = await mailer.send({
        ...actionRemindersEmail({ to: entry.email, actions: entry.actions }),
        idempotencyKey: dedupeKey,
      });
      await db
        .update(notificationDeliveries)
        .set({ status: "sent", sentAt: new Date(), providerMessageId: result.providerMessageId })
        .where(eq(notificationDeliveries.id, claimed.id));
      summary.sent += 1;
    } catch (error) {
      const retryable = error instanceof MailerError ? error.retryable : true;
      await db
        .update(notificationDeliveries)
        .set({
          status: "failed",
          errorMessage: (error as Error).message.slice(0, 500),
          ...(retryable ? {} : { attemptCount: MAX_ATTEMPTS }),
        })
        .where(eq(notificationDeliveries.id, claimed.id));
      summary.failed += 1;
    }
  }
  return summary;
}
