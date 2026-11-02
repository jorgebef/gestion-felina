/**
 * Actions (sterilization, vet visits, captures…). Managed by an association; every
 * action shows up in the feed of the town hall of its municipality, which can validate it.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  actionCats,
  actionParticipants,
  actions,
  cats,
  colonies,
  municipalities,
  organizations,
  users,
  withTenant,
  type TenantTx,
} from "@felina/db";
import type { ActionStatus } from "@felina/domain/felina";
import { madridDayBounds } from "@felina/domain/time";
import type { ActionInput, ActionListQuery } from "@felina/schemas/action";

import {
  assertAssociation,
  assertTownHall,
  DomainError,
  isAssociation,
  isTownHall,
  mapDbError,
  type OrgContext,
} from "./context.ts";
import { assertCanDelete, deletionPermissions, pendingDeletionFor } from "./permissions.ts";

const PAGE_SIZE = 50;

const catCount = sql<number>`(select count(*) from ${actionCats}
  where ${actionCats.actionId} = ${actions.id})`.mapWith(Number);
const participantCount = sql<number>`(select count(*) from ${actionParticipants}
  where ${actionParticipants.actionId} = ${actions.id})`.mapWith(Number);
/** Changed by the association after the town hall validated it. */
const modifiedAfterValidation = sql<boolean>`(${actions.validatedAt} is not null
  and ${actions.updatedAt} > ${actions.validatedAt})`;

export function listActions(ctx: OrgContext, query: ActionListQuery) {
  return withTenant(ctx.user.id, async (tx) => {
    const org = ctx.membership.organization;
    const scope = isTownHall(ctx)
      ? eq(actions.municipalityCode, org.municipalityCode ?? "")
      : eq(actions.organizationId, org.id);
    const startOfToday = madridDayBounds(new Date()).start;
    const filters: (SQL | undefined)[] = [
      scope,
      query.status ? eq(actions.status, query.status) : undefined,
      query.type ? eq(actions.actionType, query.type) : undefined,
      query.colonyId ? eq(actions.colonyId, query.colonyId) : undefined,
      query.catId
        ? sql`exists (select 1 from ${actionCats} where ${actionCats.actionId} = ${actions.id}
            and ${actionCats.catId} = ${query.catId})`
        : undefined,
      query.validation === "pending" ? isNull(actions.validatedAt) : undefined,
      query.validation === "validated" ? isNotNull(actions.validatedAt) : undefined,
      query.urgent === "yes" ? eq(actions.isUrgent, true) : undefined,
      query.when === "upcoming"
        ? and(
            gte(actions.scheduledAt, startOfToday),
            inArray(actions.status, ["planned", "in_progress"]),
          )
        : undefined,
      query.when === "past" ? lt(actions.scheduledAt, new Date()) : undefined,
    ];
    const where = and(...filters);
    const order =
      query.view === "feed"
        ? [desc(actions.createdAt)]
        : query.when === "upcoming"
          ? [asc(actions.scheduledAt)]
          : [desc(actions.scheduledAt)];
    const items = await tx
      .select({
        id: actions.id,
        name: actions.name,
        actionType: actions.actionType,
        status: actions.status,
        scheduledAt: actions.scheduledAt,
        isUrgent: actions.isUrgent,
        description: actions.description,
        colonyId: actions.colonyId,
        colonyName: colonies.name,
        municipalityName: municipalities.name,
        organizationName: organizations.name,
        validatedAt: actions.validatedAt,
        modifiedAfterValidation,
        createdAt: actions.createdAt,
        catCount,
        participantCount,
      })
      .from(actions)
      .leftJoin(colonies, eq(colonies.id, actions.colonyId))
      .leftJoin(organizations, eq(organizations.id, actions.organizationId))
      .innerJoin(municipalities, eq(municipalities.code, actions.municipalityCode))
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((query.page - 1) * PAGE_SIZE);
    const [total] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(actions)
      .where(where);
    return { items, total: total?.n ?? 0, page: query.page, pageSize: PAGE_SIZE };
  });
}

export function getAction(ctx: OrgContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const [action] = await tx
      .select({
        id: actions.id,
        organizationId: actions.organizationId,
        organizationName: organizations.name,
        colonyId: actions.colonyId,
        colonyName: colonies.name,
        municipalityCode: actions.municipalityCode,
        municipalityName: municipalities.name,
        actionType: actions.actionType,
        name: actions.name,
        description: actions.description,
        scheduledAt: actions.scheduledAt,
        isUrgent: actions.isUrgent,
        status: actions.status,
        validatedAt: actions.validatedAt,
        modifiedAfterValidation,
        createdBy: actions.createdBy,
        createdAt: actions.createdAt,
        updatedAt: actions.updatedAt,
      })
      .from(actions)
      .leftJoin(colonies, eq(colonies.id, actions.colonyId))
      .leftJoin(organizations, eq(organizations.id, actions.organizationId))
      .innerJoin(municipalities, eq(municipalities.code, actions.municipalityCode))
      .where(eq(actions.id, id));
    if (!action) throw new DomainError("NOT_FOUND", "La acción no existe o no tienes acceso");

    const actionCatRows = await tx
      .select({ id: cats.id, name: cats.name, sex: cats.sex, updatedAt: cats.updatedAt })
      .from(actionCats)
      .innerJoin(cats, eq(cats.id, actionCats.catId))
      .where(eq(actionCats.actionId, id))
      .orderBy(sql`${cats.name} asc nulls last`);
    // Names of people are only visible inside their own organization (RLS on users).
    const participants = await tx
      .select({ userId: actionParticipants.userId, name: users.fullName, email: users.email })
      .from(actionParticipants)
      .leftJoin(users, eq(users.id, actionParticipants.userId))
      .where(eq(actionParticipants.actionId, id));

    const mine = action.organizationId === ctx.membership.organization.id;
    const canEdit = mine && isAssociation(ctx);
    const { createdBy: _createdBy, ...rest } = action;
    return {
      action: rest,
      cats: actionCatRows,
      participants: mine ? participants : [],
      participantCount: participants.length,
      pendingDeletion: mine ? await pendingDeletionFor(tx, ctx, "action", id) : null,
      permissions: {
        canEdit,
        ...deletionPermissions(ctx, mine, canEdit),
        canValidate:
          isTownHall(ctx) &&
          ctx.membership.organization.municipalityCode === action.municipalityCode,
      },
    };
  });
}

/** The colony's municipality, else the one chosen, else the first cat's. */
async function resolveMunicipality(tx: TenantTx, ctx: OrgContext, data: ActionInput) {
  const orgId = ctx.membership.organization.id;
  if (data.colonyId) {
    const [colony] = await tx
      .select({ municipalityCode: colonies.municipalityCode })
      .from(colonies)
      .where(and(eq(colonies.id, data.colonyId), eq(colonies.organizationId, orgId)));
    if (!colony) throw new DomainError("VALIDATION", "La colonia elegida no es de tu asociación");
    return colony.municipalityCode;
  }
  if (data.municipalityCode) return data.municipalityCode;
  const [cat] = await tx
    .select({ municipalityCode: cats.municipalityCode })
    .from(cats)
    .where(and(inArray(cats.id, data.catIds), eq(cats.organizationId, orgId)))
    .limit(1);
  if (!cat) throw new DomainError("VALIDATION", "Indica el municipio de la acción");
  return cat.municipalityCode;
}

async function replaceLinks(tx: TenantTx, ctx: OrgContext, actionId: string, data: ActionInput) {
  const catIds = [...new Set(data.catIds)];
  const participantIds = [
    ...new Set(data.participantIds.length ? data.participantIds : [ctx.user.id]),
  ];
  await tx.delete(actionCats).where(eq(actionCats.actionId, actionId));
  await tx.delete(actionParticipants).where(eq(actionParticipants.actionId, actionId));
  if (catIds.length) {
    await tx.insert(actionCats).values(catIds.map((catId) => ({ actionId, catId })));
  }
  await tx
    .insert(actionParticipants)
    .values(participantIds.map((userId) => ({ actionId, userId })));
}

function values(data: ActionInput, municipalityCode: string) {
  return {
    actionType: data.actionType,
    name: data.name,
    description: data.description,
    scheduledAt: new Date(data.scheduledAt),
    isUrgent: data.isUrgent,
    status: data.status,
    colonyId: data.colonyId,
    municipalityCode,
  };
}

/**
 * A sterilization that ends up done marks its cats as sterilized (only those that
 * aren't yet). Reopening or cancelling the action never unmarks them: that is a
 * manual decision on the cat. Returns how many cats changed. Any member completes
 * actions, also on cats of colonies they don't manage, hence the database function.
 */
async function markCatsSterilized(tx: TenantTx, actionId: string): Promise<number> {
  const result = await tx.execute<{ count: number }>(
    sql`select app_mark_action_cats_sterilized(${actionId}) as count`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

const writeErrors = {
  VALIDATION: "Los gatos y participantes deben ser de tu asociación",
};

export async function createAction(ctx: OrgContext, data: ActionInput) {
  assertAssociation(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const municipalityCode = await resolveMunicipality(tx, ctx, data);
    const [row] = await tx
      .insert(actions)
      .values({
        ...values(data, municipalityCode),
        organizationId: ctx.membership.organization.id,
        createdBy: ctx.user.id,
      })
      .returning({ id: actions.id });
    await replaceLinks(tx, ctx, row!.id, data);
    await markCatsSterilized(tx, row!.id);
    return { id: row!.id };
  }).catch((error) => mapDbError(error, writeErrors));
}

export async function updateAction(ctx: OrgContext, id: string, data: ActionInput) {
  assertAssociation(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const municipalityCode = await resolveMunicipality(tx, ctx, data);
    const updated = await tx
      .update(actions)
      .set(values(data, municipalityCode))
      .where(and(eq(actions.id, id), eq(actions.organizationId, ctx.membership.organization.id)))
      .returning({ id: actions.id });
    if (!updated.length) throw new DomainError("NOT_FOUND", "La acción no existe");
    await replaceLinks(tx, ctx, id, data);
    await markCatsSterilized(tx, id);
    return { ok: true as const };
  }).catch((error) => mapDbError(error, writeErrors));
}

export async function setActionStatus(ctx: OrgContext, id: string, status: ActionStatus) {
  assertAssociation(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(actions)
      .set({ status })
      .where(and(eq(actions.id, id), eq(actions.organizationId, ctx.membership.organization.id)))
      .returning({ id: actions.id });
    if (!updated.length) throw new DomainError("NOT_FOUND", "La acción no existe");
    const sterilizedCats = status === "done" ? await markCatsSterilized(tx, id) : 0;
    return { ok: true as const, sterilizedCats };
  });
}

/** Admins only; the rest ask for it (deletions.ts). */
export async function deleteAction(ctx: OrgContext, id: string) {
  assertAssociation(ctx);
  assertCanDelete(ctx);
  return withTenant(ctx.user.id, (tx) => deleteActionIn(tx, ctx, id));
}

export async function deleteActionIn(tx: TenantTx, ctx: OrgContext, id: string) {
  const deleted = await tx
    .delete(actions)
    .where(and(eq(actions.id, id), eq(actions.organizationId, ctx.membership.organization.id)))
    .returning({ id: actions.id });
  if (!deleted.length) throw new DomainError("NOT_FOUND", "La acción no existe");
  return { ok: true as const };
}

export async function setActionValidation(ctx: OrgContext, id: string, validated: boolean) {
  assertTownHall(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    await tx.execute(sql`select app_set_action_validation(${id}, ${validated})`);
    return { ok: true as const };
  }).catch((error) =>
    mapDbError(error, { NOT_FOUND: "La acción no existe o no es de tu municipio" }),
  );
}

/** Cats of the caller's association, for the action form. */
export function listCatOptions(ctx: OrgContext) {
  return withTenant(ctx.user.id, (tx) =>
    tx
      .select({
        id: cats.id,
        name: cats.name,
        colonyId: cats.colonyId,
        municipalityCode: cats.municipalityCode,
        updatedAt: cats.updatedAt,
      })
      .from(cats)
      .where(eq(cats.organizationId, ctx.membership.organization.id))
      .orderBy(sql`${cats.name} asc nulls last`, asc(cats.createdAt)),
  );
}
