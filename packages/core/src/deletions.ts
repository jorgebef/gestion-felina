/**
 * Deletion requests. Only association admins delete colonies, cats and actions; anyone
 * else who may edit one asks for its deletion, and it stays until an admin approves it
 * (the item is deleted) or rejects it. Admins get an email for every request and the
 * requester one when it is resolved.
 */
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  actions,
  cats,
  colonies,
  deletionRequests,
  getDb,
  organizationMembers,
  users,
  withTenant,
  type TenantTx,
} from "@felina/db";
import { catDisplayName, type DeletionTarget } from "@felina/domain/felina";
import { sendSafely } from "@felina/notifications/mailer";
import {
  appUrl,
  deletionRequestedEmail,
  deletionResolvedEmail,
} from "@felina/notifications/templates";
import type {
  DeletionListQuery,
  DeletionRequestInput,
  DeletionResolution,
} from "@felina/schemas/deletion";

import { deleteActionIn } from "./actions.ts";
import { deleteCatIn, deletePhotoQuietly } from "./cats.ts";
import { deleteColonyIn } from "./colonies.ts";
import {
  assertAdmin,
  assertAssociation,
  DomainError,
  isAdmin,
  mapDbError,
  type OrgContext,
} from "./context.ts";

const TARGET_NOUNS: Record<DeletionTarget, string> = {
  colony: "la colonia",
  cat: "el gato",
  action: "la acción",
};

/** «la colonia «Parque del Oeste»», for emails. */
function describe(type: DeletionTarget, label: string) {
  return `${TARGET_NOUNS[type]} «${label}»`;
}

function targetUrl(type: DeletionTarget, id: string) {
  const base = type === "colony" ? "colonias" : type === "cat" ? "gatos" : "acciones";
  return appUrl(`/${base}/${id}`);
}

/** Name of a colony, cat or action of the caller's association (NOT_FOUND otherwise). */
async function targetName(
  tx: TenantTx,
  ctx: OrgContext,
  type: DeletionTarget,
  id: string,
): Promise<string> {
  const orgId = ctx.membership.organization.id;
  let name: string | null | undefined;
  if (type === "colony") {
    const [row] = await tx
      .select({ name: colonies.name })
      .from(colonies)
      .where(and(eq(colonies.id, id), eq(colonies.organizationId, orgId)));
    name = row?.name;
  } else if (type === "cat") {
    const [row] = await tx
      .select({ name: cats.name })
      .from(cats)
      .where(and(eq(cats.id, id), eq(cats.organizationId, orgId)));
    name = row ? catDisplayName(row) : undefined;
  } else {
    const [row] = await tx
      .select({ name: actions.name })
      .from(actions)
      .where(and(eq(actions.id, id), eq(actions.organizationId, orgId)));
    name = row?.name;
  }
  if (name === undefined) throw new DomainError("NOT_FOUND", "No existe o no es de tu asociación");
  return name;
}

async function associationAdminEmails(organizationId: string): Promise<string[]> {
  const admins = await getDb()
    .select({ email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "admin"),
      ),
    );
  return admins.map((a) => a.email);
}

export async function requestDeletion(ctx: OrgContext, input: DeletionRequestInput) {
  assertAssociation(ctx);
  if (isAdmin(ctx)) {
    throw new DomainError("CONFLICT", "Como administrador/a puedes eliminarlo directamente");
  }
  const { targetType, targetId } = input;
  const created = await withTenant(ctx.user.id, async (tx) => {
    const label = await targetName(tx, ctx, targetType, targetId);
    const [row] = await tx
      .insert(deletionRequests)
      .values({
        organizationId: ctx.membership.organization.id,
        targetType,
        colonyId: targetType === "colony" ? targetId : null,
        catId: targetType === "cat" ? targetId : null,
        actionId: targetType === "action" ? targetId : null,
        targetLabel: label,
        reason: input.reason,
        requestedBy: ctx.user.id,
      })
      .returning({ id: deletionRequests.id });
    return { id: row!.id, label };
  }).catch((error) =>
    mapDbError(error, {
      CONFLICT: "Ya hay una solicitud de eliminación pendiente",
      FORBIDDEN:
        targetType === "action"
          ? "No puedes solicitar la eliminación de esta acción"
          : "Solo los gestores de la colonia pueden solicitar su eliminación o la de sus gatos",
    }),
  );

  const emails = await associationAdminEmails(ctx.membership.organization.id);
  await Promise.all(
    emails.map((to) =>
      sendSafely(
        deletionRequestedEmail({
          to,
          requesterName: ctx.user.name || ctx.user.email,
          targetLabel: describe(targetType, created.label),
          reason: input.reason,
          url: targetUrl(targetType, targetId),
        }),
      ),
    ),
  );
  return { id: created.id };
}

const requester = alias(users, "requester");
const resolver = alias(users, "resolver");

export function listDeletionRequests(ctx: OrgContext, query: DeletionListQuery) {
  assertAssociation(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const filters: (SQL | undefined)[] = [
      eq(deletionRequests.organizationId, ctx.membership.organization.id),
      query.status ? eq(deletionRequests.status, query.status) : undefined,
    ];
    const rows = await tx
      .select({
        id: deletionRequests.id,
        targetType: deletionRequests.targetType,
        colonyId: deletionRequests.colonyId,
        catId: deletionRequests.catId,
        actionId: deletionRequests.actionId,
        targetLabel: deletionRequests.targetLabel,
        reason: deletionRequests.reason,
        status: deletionRequests.status,
        resolutionNote: deletionRequests.resolutionNote,
        resolvedAt: deletionRequests.resolvedAt,
        createdAt: deletionRequests.createdAt,
        requestedBy: deletionRequests.requestedBy,
        requestedByName: requester.fullName,
        requestedByEmail: requester.email,
        resolvedByName: resolver.fullName,
        resolvedByEmail: resolver.email,
      })
      .from(deletionRequests)
      .leftJoin(requester, eq(requester.id, deletionRequests.requestedBy))
      .leftJoin(resolver, eq(resolver.id, deletionRequests.resolvedBy))
      .where(and(...filters))
      // Pending first, then the most recent.
      .orderBy(sql`(${deletionRequests.status} = 'pending') desc`, desc(deletionRequests.createdAt))
      .limit(200);
    return rows.map(
      ({
        requestedBy,
        requestedByName,
        requestedByEmail,
        resolvedByName,
        resolvedByEmail,
        ...r
      }) => ({
        ...r,
        targetId: r.colonyId ?? r.catId ?? r.actionId,
        requestedByName: requestedByName || requestedByEmail || null,
        resolvedByName: resolvedByName || resolvedByEmail || null,
        mine: requestedBy === ctx.user.id,
      }),
    );
  });
}

/** Admins approve (the item is deleted) or reject a pending request. */
export async function resolveDeletion(ctx: OrgContext, id: string, input: DeletionResolution) {
  assertAssociation(ctx);
  assertAdmin(ctx);
  const approved = input.decision === "approve";
  const resolved = await withTenant(ctx.user.id, async (tx) => {
    const [request] = await tx
      .select()
      .from(deletionRequests)
      .where(
        and(
          eq(deletionRequests.id, id),
          eq(deletionRequests.organizationId, ctx.membership.organization.id),
          eq(deletionRequests.status, "pending"),
        ),
      )
      .for("update");
    if (!request) {
      throw new DomainError("NOT_FOUND", "La solicitud no existe o ya está resuelta");
    }
    let photoKey: string | null = null;
    if (approved) {
      if (input.note) {
        await tx
          .update(deletionRequests)
          .set({ resolutionNote: input.note })
          .where(eq(deletionRequests.id, id));
      }
      // Deleting the item marks its pending requests approved by the caller (trigger).
      if (request.targetType === "colony") await deleteColonyIn(tx, ctx, request.colonyId!);
      else if (request.targetType === "cat") photoKey = await deleteCatIn(tx, ctx, request.catId!);
      else await deleteActionIn(tx, ctx, request.actionId!);
    } else {
      await tx
        .update(deletionRequests)
        .set({
          status: "rejected",
          resolutionNote: input.note,
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(deletionRequests.id, id));
    }
    return { request, photoKey };
  });

  if (resolved.photoKey) await deletePhotoQuietly(resolved.photoKey);
  const { request } = resolved;
  if (request.requestedBy) {
    const [author] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, request.requestedBy));
    const targetId = request.colonyId ?? request.catId ?? request.actionId;
    if (author) {
      await sendSafely(
        deletionResolvedEmail({
          to: author.email,
          targetLabel: describe(request.targetType, request.targetLabel),
          approved,
          note: input.note,
          url:
            approved || !targetId
              ? appUrl("/eliminaciones")
              : targetUrl(request.targetType, targetId),
        }),
      );
    }
  }
  return { ok: true as const };
}

/** The person who asked can take it back while it is pending. */
export async function withdrawDeletion(ctx: OrgContext, id: string) {
  assertAssociation(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(deletionRequests)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(deletionRequests.id, id),
          eq(deletionRequests.requestedBy, ctx.user.id),
          eq(deletionRequests.status, "pending"),
        ),
      )
      .returning({ id: deletionRequests.id });
    if (!updated.length) {
      throw new DomainError("NOT_FOUND", "La solicitud no existe o ya está resuelta");
    }
    return { ok: true as const };
  });
}
