/** Colonies: managed by one association, visible to (and authorized by) their town hall. */
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  actions,
  cats,
  changeProposals,
  colonies,
  municipalities,
  organizations,
  withTenant,
} from "@felina/db";
import type { ColonyInput, ColonyListQuery } from "@felina/schemas/colony";

import {
  assertAdmin,
  assertAssociation,
  assertTownHall,
  DomainError,
  isAdmin,
  isAssociation,
  isTownHall,
  mapDbError,
  type OrgContext,
} from "./context.ts";

const catCount =
  sql<number>`(select count(*) from ${cats} where ${cats.colonyId} = ${colonies.id})`.mapWith(
    Number,
  );
const pendingProposals = sql<number>`(select count(*) from ${changeProposals}
  where ${changeProposals.colonyId} = ${colonies.id} and ${changeProposals.status} = 'pending')`.mapWith(
  Number,
);
const lastActionAt = sql<string | null>`(select max(${actions.scheduledAt}) from ${actions}
  where ${actions.colonyId} = ${colonies.id} and ${actions.status} <> 'cancelled')`;

export function listColonies(ctx: OrgContext, query: ColonyListQuery) {
  return withTenant(ctx.user.id, async (tx) => {
    const org = ctx.membership.organization;
    const scope = isTownHall(ctx)
      ? eq(colonies.municipalityCode, org.municipalityCode ?? "")
      : eq(colonies.organizationId, org.id);
    const filters: (SQL | undefined)[] = [
      scope,
      query.q
        ? or(ilike(colonies.name, `%${query.q}%`), ilike(colonies.address, `%${query.q}%`))
        : undefined,
      query.authorized === "yes" ? isNotNull(colonies.authorizedAt) : undefined,
      query.authorized === "no" ? isNull(colonies.authorizedAt) : undefined,
    ];
    return tx
      .select({
        id: colonies.id,
        name: colonies.name,
        address: colonies.address,
        latitude: colonies.latitude,
        longitude: colonies.longitude,
        municipalityCode: colonies.municipalityCode,
        municipalityName: municipalities.name,
        organizationName: organizations.name,
        authorizedAt: colonies.authorizedAt,
        catCount,
        pendingProposals,
        // Raw SQL timestamps arrive as Postgres text ("2026-11-02 17:12:48+01"); send ISO 8601
        // like every other date (not every JS engine parses the Postgres form, e.g. Hermes).
        lastActionAt: sql<string | null>`${lastActionAt}`.mapWith((v: string | null) =>
          v === null ? null : new Date(v).toISOString(),
        ),
        createdAt: colonies.createdAt,
      })
      .from(colonies)
      .innerJoin(municipalities, eq(municipalities.code, colonies.municipalityCode))
      .leftJoin(organizations, eq(organizations.id, colonies.organizationId))
      .where(and(...filters))
      .orderBy(asc(colonies.name))
      .limit(500);
  });
}

export function getColony(ctx: OrgContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const [colony] = await tx
      .select({
        id: colonies.id,
        organizationId: colonies.organizationId,
        organizationName: organizations.name,
        name: colonies.name,
        description: colonies.description,
        latitude: colonies.latitude,
        longitude: colonies.longitude,
        municipalityCode: colonies.municipalityCode,
        municipalityName: municipalities.name,
        address: colonies.address,
        authorizedAt: colonies.authorizedAt,
        createdAt: colonies.createdAt,
        updatedAt: colonies.updatedAt,
      })
      .from(colonies)
      .innerJoin(municipalities, eq(municipalities.code, colonies.municipalityCode))
      .leftJoin(organizations, eq(organizations.id, colonies.organizationId))
      .where(eq(colonies.id, id));
    if (!colony) throw new DomainError("NOT_FOUND", "La colonia no existe o no tienes acceso");

    const colonyCats = await tx
      .select({
        id: cats.id,
        name: cats.name,
        sex: cats.sex,
        birthDate: cats.birthDate,
        birthDateApproximate: cats.birthDateApproximate,
        sterilized: cats.sterilized,
        updatedAt: cats.updatedAt,
      })
      .from(cats)
      .where(eq(cats.colonyId, id))
      .orderBy(sql`${cats.name} asc nulls last`, asc(cats.createdAt));

    const recentActions = await tx
      .select({
        id: actions.id,
        name: actions.name,
        actionType: actions.actionType,
        status: actions.status,
        scheduledAt: actions.scheduledAt,
        isUrgent: actions.isUrgent,
        validatedAt: actions.validatedAt,
      })
      .from(actions)
      .where(eq(actions.colonyId, id))
      .orderBy(desc(actions.scheduledAt))
      .limit(20);

    const mine = colony.organizationId === ctx.membership.organization.id;
    const townHall =
      isTownHall(ctx) && ctx.membership.organization.municipalityCode === colony.municipalityCode;
    return {
      colony,
      cats: colonyCats,
      actions: recentActions,
      permissions: {
        canEdit: mine && isAdmin(ctx),
        canDelete: mine && isAdmin(ctx),
        canAddCats: mine && isAssociation(ctx),
        canAuthorize: townHall,
        canPropose: townHall,
      },
    };
  });
}

function values(data: ColonyInput) {
  return {
    name: data.name,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
    municipalityCode: data.municipalityCode,
    address: data.address,
  };
}

const writeErrors = {
  FORBIDDEN: "Solo los administradores de la asociación gestionan las colonias",
  VALIDATION: "Revisa los datos de la colonia",
};

export async function createColony(ctx: OrgContext, data: ColonyInput) {
  assertAssociation(ctx);
  assertAdmin(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const [row] = await tx
      .insert(colonies)
      .values({
        ...values(data),
        organizationId: ctx.membership.organization.id,
        createdBy: ctx.user.id,
      })
      .returning({ id: colonies.id });
    return { id: row!.id };
  }).catch((error) => mapDbError(error, writeErrors));
}

export async function updateColony(ctx: OrgContext, id: string, data: ColonyInput) {
  assertAssociation(ctx);
  assertAdmin(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(colonies)
      .set(values(data))
      .where(and(eq(colonies.id, id), eq(colonies.organizationId, ctx.membership.organization.id)))
      .returning({ id: colonies.id });
    if (!updated.length) throw new DomainError("NOT_FOUND", "La colonia no existe");
    return { ok: true as const };
  }).catch((error) => mapDbError(error, writeErrors));
}

/** Its cats stay in the association (without colony); its actions keep their history. */
export async function deleteColony(ctx: OrgContext, id: string) {
  assertAssociation(ctx);
  assertAdmin(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const deleted = await tx
      .delete(colonies)
      .where(and(eq(colonies.id, id), eq(colonies.organizationId, ctx.membership.organization.id)))
      .returning({ id: colonies.id });
    if (!deleted.length) throw new DomainError("NOT_FOUND", "La colonia no existe");
    return { ok: true as const };
  });
}

export async function setColonyAuthorization(ctx: OrgContext, id: string, authorized: boolean) {
  assertTownHall(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    await tx.execute(sql`select app_set_colony_authorization(${id}, ${authorized})`);
    return { ok: true as const };
  }).catch((error) =>
    mapDbError(error, { NOT_FOUND: "La colonia no existe o no es de tu municipio" }),
  );
}
