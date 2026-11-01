/** "Mis licitaciones": saved tenders, private notes, workflow states and tasks. */
import { and, asc, desc, eq, sql } from "drizzle-orm";

import {
  contractingAuthorities,
  tenderMatches,
  tenderTasks,
  tenders,
  trackedTenders,
  withTenant,
} from "@licita/db";
import type { WorkflowStatusValue } from "@licita/domain/tenders";
import type { MatchFeedback } from "@licita/schemas/matches";
import type { TaskInput, TrackedUpdate } from "@licita/schemas/tracking";

import { DomainError, type CompanyContext } from "./context.ts";

export function listTracked(ctx: CompanyContext, status?: WorkflowStatusValue) {
  return withTenant(ctx.user.id, async (tx) => {
    const rows = await tx
      .select({
        id: trackedTenders.id,
        workflowStatus: trackedTenders.workflowStatus,
        notes: trackedTenders.notes,
        updatedAt: trackedTenders.updatedAt,
        tenderId: tenders.id,
        title: tenders.title,
        status: tenders.status,
        expedienteNumber: tenders.expedienteNumber,
        submissionDeadlineAt: tenders.submissionDeadlineAt,
        baseBudgetExVatEur: tenders.baseBudgetExVatEur,
        contractType: tenders.contractType,
        executionProvinces: tenders.executionProvinces,
        authorityName: contractingAuthorities.name,
        openTasks: sql<number>`(
          select count(*) from ${tenderTasks}
          where ${tenderTasks.trackedTenderId} = ${trackedTenders.id}
            and ${tenderTasks.completedAt} is null
        )`.mapWith(Number),
        nextTaskDueAt: sql<Date | null>`(
          select min(${tenderTasks.dueAt}) from ${tenderTasks}
          where ${tenderTasks.trackedTenderId} = ${trackedTenders.id}
            and ${tenderTasks.completedAt} is null
        )`.mapWith((v) => (v ? new Date(v) : null)),
      })
      .from(trackedTenders)
      .innerJoin(tenders, eq(tenders.id, trackedTenders.tenderId))
      .leftJoin(contractingAuthorities, eq(contractingAuthorities.id, tenders.authorityId))
      .where(
        and(
          eq(trackedTenders.companyId, ctx.company.id),
          status ? eq(trackedTenders.workflowStatus, status) : undefined,
        ),
      )
      .orderBy(sql`${tenders.submissionDeadlineAt} asc nulls last`, desc(trackedTenders.updatedAt));
    const counts = await tx
      .select({ status: trackedTenders.workflowStatus, n: sql<number>`count(*)`.mapWith(Number) })
      .from(trackedTenders)
      .where(eq(trackedTenders.companyId, ctx.company.id))
      .groupBy(trackedTenders.workflowStatus);
    return {
      items: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<
        Record<WorkflowStatusValue, number>
      >,
    };
  });
}

export function trackTender(ctx: CompanyContext, tenderId: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const [exists] = await tx
      .select({ id: tenders.id })
      .from(tenders)
      .where(eq(tenders.id, tenderId));
    if (!exists) throw new DomainError("NOT_FOUND");
    const [row] = await tx
      .insert(trackedTenders)
      .values({ companyId: ctx.company.id, tenderId })
      .onConflictDoNothing({ target: [trackedTenders.companyId, trackedTenders.tenderId] })
      .returning({ id: trackedTenders.id });
    if (row) return { id: row.id };
    const [current] = await tx
      .select({ id: trackedTenders.id })
      .from(trackedTenders)
      .where(
        and(eq(trackedTenders.companyId, ctx.company.id), eq(trackedTenders.tenderId, tenderId)),
      );
    return { id: current!.id };
  });
}

export function untrackTender(ctx: CompanyContext, tenderId: string) {
  return withTenant(ctx.user.id, async (tx) => {
    await tx
      .delete(trackedTenders)
      .where(
        and(eq(trackedTenders.companyId, ctx.company.id), eq(trackedTenders.tenderId, tenderId)),
      );
    return { ok: true as const };
  });
}

export function updateTracked(ctx: CompanyContext, id: string, data: TrackedUpdate) {
  return withTenant(ctx.user.id, async (tx) => {
    const set: Partial<typeof trackedTenders.$inferInsert> = {};
    if (data.workflowStatus) set.workflowStatus = data.workflowStatus;
    if (data.notes !== undefined) set.notes = data.notes?.trim() || null;
    if (!Object.keys(set).length) return { ok: true as const };
    const updated = await tx
      .update(trackedTenders)
      .set(set)
      .where(and(eq(trackedTenders.id, id), eq(trackedTenders.companyId, ctx.company.id)))
      .returning({ id: trackedTenders.id });
    if (!updated.length) throw new DomainError("NOT_FOUND");
    return { ok: true as const };
  });
}

/** Tracking record and tasks of one tender, or null when the company hasn't saved it. */
export function getTrackedDetail(ctx: CompanyContext, tenderId: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const [tracked] = await tx
      .select()
      .from(trackedTenders)
      .where(
        and(eq(trackedTenders.companyId, ctx.company.id), eq(trackedTenders.tenderId, tenderId)),
      );
    if (!tracked) return null;
    const tasks = await tx
      .select()
      .from(tenderTasks)
      .where(eq(tenderTasks.trackedTenderId, tracked.id))
      .orderBy(
        sql`${tenderTasks.completedAt} is not null`,
        sql`${tenderTasks.dueAt} asc nulls last`,
        asc(tenderTasks.createdAt),
      );
    return { tracked, tasks };
  });
}

export function createTask(ctx: CompanyContext, trackedId: string, data: TaskInput) {
  return withTenant(ctx.user.id, async (tx) => {
    // RLS also enforces this; the explicit check gives a clear error.
    const [tracked] = await tx
      .select({ id: trackedTenders.id })
      .from(trackedTenders)
      .where(and(eq(trackedTenders.id, trackedId), eq(trackedTenders.companyId, ctx.company.id)));
    if (!tracked) throw new DomainError("NOT_FOUND");
    const [task] = await tx
      .insert(tenderTasks)
      .values({
        trackedTenderId: tracked.id,
        title: data.title,
        description: data.description ?? null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        origin: "manual",
      })
      .returning({ id: tenderTasks.id });
    return { id: task!.id };
  });
}

export function setTaskCompleted(ctx: CompanyContext, id: string, completed: boolean) {
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(tenderTasks)
      .set({ completedAt: completed ? new Date() : null })
      .where(eq(tenderTasks.id, id))
      .returning({ id: tenderTasks.id });
    if (!updated.length) throw new DomainError("NOT_FOUND");
    return { ok: true as const };
  });
}

export function deleteTask(ctx: CompanyContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const deleted = await tx
      .delete(tenderTasks)
      .where(eq(tenderTasks.id, id))
      .returning({ id: tenderTasks.id });
    if (!deleted.length) throw new DomainError("NOT_FOUND");
    return { ok: true as const };
  });
}

export function setMatchFeedback(ctx: CompanyContext, id: string, feedback: MatchFeedback) {
  return withTenant(ctx.user.id, async (tx) => {
    // RLS restricts the update to matches of the caller's company profiles.
    const updated = await tx
      .update(tenderMatches)
      .set({ feedback })
      .where(eq(tenderMatches.id, id))
      .returning({ id: tenderMatches.id });
    if (!updated.length) throw new DomainError("NOT_FOUND");
    return { ok: true as const };
  });
}
