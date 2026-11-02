/**
 * Who may change what inside an association, mirroring the RLS policies in
 * packages/db/migrations/0005 (the database has the last word; these only shape the API
 * responses and give clearer errors):
 *
 *   * Admins manage every colony; other members manage the colonies they are managers of.
 *     Managing a colony means editing it and registering or editing its cats.
 *   * Cats without a colony and actions can be edited by any member.
 *   * Only admins delete. Everyone else asks for the deletion (`deletions.ts`).
 */
import { and, eq, sql } from "drizzle-orm";

import { deletionRequests, users, type TenantTx } from "@felina/db";
import type { DeletionTarget } from "@felina/domain/felina";

import { DomainError, isAdmin, type OrgContext } from "./context.ts";

export async function canManageColony(tx: TenantTx, colonyId: string): Promise<boolean> {
  const result = await tx.execute<{ ok: boolean }>(
    sql`select app_can_manage_colony(${colonyId}) as ok`,
  );
  return result.rows[0]?.ok === true;
}

/** Same rule as the RLS policies, as a column: `app_can_manage_colony(colonies.id)`. */
export function canManageColonySql(colonyId: unknown) {
  return sql<boolean>`app_can_manage_colony(${colonyId})`.mapWith(Boolean);
}

export async function assertCanManageColony(tx: TenantTx, colonyId: string): Promise<void> {
  if (!(await canManageColony(tx, colonyId))) {
    throw new DomainError(
      "FORBIDDEN",
      "Solo los gestores de la colonia y los administradores pueden modificarla",
    );
  }
}

/** Deletes go straight through for admins; the rest must ask (see `deletions.ts`). */
export function assertCanDelete(ctx: OrgContext): void {
  if (!isAdmin(ctx)) {
    throw new DomainError(
      "FORBIDDEN",
      "Solo los administradores eliminan directamente: solicita la eliminación",
    );
  }
}

/** The open deletion request of a colony, cat or action, for its detail page. */
export async function pendingDeletionFor(
  tx: TenantTx,
  ctx: OrgContext,
  type: DeletionTarget,
  id: string,
) {
  const column =
    type === "colony"
      ? deletionRequests.colonyId
      : type === "cat"
        ? deletionRequests.catId
        : deletionRequests.actionId;
  const [row] = await tx
    .select({
      id: deletionRequests.id,
      reason: deletionRequests.reason,
      createdAt: deletionRequests.createdAt,
      requestedBy: deletionRequests.requestedBy,
      requestedByName: users.fullName,
      requestedByEmail: users.email,
    })
    .from(deletionRequests)
    .leftJoin(users, eq(users.id, deletionRequests.requestedBy))
    .where(and(eq(column, id), eq(deletionRequests.status, "pending")));
  if (!row) return null;
  const { requestedBy, requestedByName, requestedByEmail, ...rest } = row;
  return {
    ...rest,
    requestedByName: requestedByName || requestedByEmail || null,
    requestedByMe: requestedBy === ctx.user.id,
  };
}

/**
 * The delete/ask-for-deletion trio every detail page shows. `canEdit` is whether the
 * caller may change the item (only those may ask for its deletion).
 */
export function deletionPermissions(ctx: OrgContext, mine: boolean, canEdit: boolean) {
  return {
    canDelete: mine && isAdmin(ctx),
    canRequestDeletion: mine && canEdit && !isAdmin(ctx),
    canResolveDeletion: mine && isAdmin(ctx),
  };
}
