import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { tenderTasks, tenders, trackedTenders, type TenantTx } from "@licita/db";

/** Open tasks with a due date, across all tracked tenders of the company. */
export async function upcomingTasks(tx: TenantTx, companyId: string, limit = 8) {
  return tx
    .select({
      id: tenderTasks.id,
      title: tenderTasks.title,
      dueAt: tenderTasks.dueAt,
      tenderId: tenders.id,
      tenderTitle: tenders.title,
    })
    .from(tenderTasks)
    .innerJoin(trackedTenders, eq(trackedTenders.id, tenderTasks.trackedTenderId))
    .innerJoin(tenders, eq(tenders.id, trackedTenders.tenderId))
    .where(
      and(
        eq(trackedTenders.companyId, companyId),
        isNull(tenderTasks.completedAt),
        sql`${tenderTasks.dueAt} is not null`,
        inArray(trackedTenders.workflowStatus, ["saved", "evaluating", "preparing", "submitted"]),
      ),
    )
    .orderBy(asc(tenderTasks.dueAt))
    .limit(limit);
}
