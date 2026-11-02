/** Cats: registered by association members; visible to the town hall of their municipality. */
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  actionCats,
  actions,
  cats,
  colonies,
  municipalities,
  organizations,
  withTenant,
  type TenantTx,
} from "@felina/db";
import { getStorage } from "@felina/storage";
import type { CatInput, CatListQuery } from "@felina/schemas/cat";

import {
  assertAssociation,
  DomainError,
  isAssociation,
  isTownHall,
  mapDbError,
  type OrgContext,
} from "./context.ts";
import { deleteImageQuietly, storeImage } from "./images.ts";
import {
  assertCanDelete,
  canManageColony,
  canManageColonySql,
  deletionPermissions,
  pendingDeletionFor,
} from "./permissions.ts";

export function listCats(ctx: OrgContext, query: CatListQuery) {
  return withTenant(ctx.user.id, (tx) => {
    const org = ctx.membership.organization;
    const scope = isTownHall(ctx)
      ? or(
          eq(cats.municipalityCode, org.municipalityCode ?? ""),
          eq(colonies.municipalityCode, org.municipalityCode ?? ""),
        )
      : eq(cats.organizationId, org.id);
    const filters: (SQL | undefined)[] = [
      scope,
      query.q
        ? or(ilike(cats.name, `%${query.q}%`), ilike(cats.description, `%${query.q}%`))
        : undefined,
      query.colonyId ? eq(cats.colonyId, query.colonyId) : undefined,
      query.colony === "none" ? isNull(cats.colonyId) : undefined,
      query.sex ? eq(cats.sex, query.sex) : undefined,
    ];
    return tx
      .select({
        id: cats.id,
        name: cats.name,
        sex: cats.sex,
        birthDate: cats.birthDate,
        birthDateApproximate: cats.birthDateApproximate,
        colonyId: cats.colonyId,
        colonyName: colonies.name,
        municipalityName: municipalities.name,
        sterilized: cats.sterilized,
        updatedAt: cats.updatedAt,
      })
      .from(cats)
      .leftJoin(colonies, eq(colonies.id, cats.colonyId))
      .innerJoin(municipalities, eq(municipalities.code, cats.municipalityCode))
      .where(and(...filters))
      .orderBy(desc(cats.createdAt))
      .limit(500);
  });
}

export function getCat(ctx: OrgContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const [cat] = await tx
      .select({
        id: cats.id,
        organizationId: cats.organizationId,
        organizationName: organizations.name,
        organizationAvatar: organizations.avatarKey,
        colonyId: cats.colonyId,
        colonyName: colonies.name,
        name: cats.name,
        sex: cats.sex,
        birthDate: cats.birthDate,
        birthDateApproximate: cats.birthDateApproximate,
        description: cats.description,
        latitude: cats.latitude,
        longitude: cats.longitude,
        municipalityCode: cats.municipalityCode,
        municipalityName: municipalities.name,
        address: cats.address,
        photoKey: cats.photoKey,
        createdBy: cats.createdBy,
        createdAt: cats.createdAt,
        updatedAt: cats.updatedAt,
        sterilized: cats.sterilized,
      })
      .from(cats)
      .leftJoin(colonies, eq(colonies.id, cats.colonyId))
      .leftJoin(organizations, eq(organizations.id, cats.organizationId))
      .innerJoin(municipalities, eq(municipalities.code, cats.municipalityCode))
      .where(eq(cats.id, id));
    if (!cat) throw new DomainError("NOT_FOUND", "El gato no existe o no tienes acceso");

    const history = await tx
      .select({
        id: actions.id,
        name: actions.name,
        actionType: actions.actionType,
        status: actions.status,
        scheduledAt: actions.scheduledAt,
        isUrgent: actions.isUrgent,
        validatedAt: actions.validatedAt,
      })
      .from(actionCats)
      .innerJoin(actions, eq(actions.id, actionCats.actionId))
      .where(eq(actionCats.catId, id))
      .orderBy(desc(actions.scheduledAt));

    const mine = cat.organizationId === ctx.membership.organization.id;
    const town = ctx.membership.organization.municipalityCode;
    // Cats without a colony are any member's; the rest belong to their colony's managers.
    const canEdit =
      mine &&
      isAssociation(ctx) &&
      (cat.colonyId === null || (await canManageColony(tx, cat.colonyId)));
    const { createdBy: _createdBy, photoKey, ...rest } = cat;
    return {
      cat: rest,
      /** Only for the managing association (needed to keep the photo when editing). */
      photoKey: mine ? photoKey : null,
      actions: history,
      pendingDeletion: mine ? await pendingDeletionFor(tx, ctx, "cat", id) : null,
      permissions: {
        canEdit,
        /** Actions are any member's, whoever manages the cat. */
        canAddActions: mine && isAssociation(ctx),
        ...deletionPermissions(ctx, mine, canEdit),
        canPropose: isTownHall(ctx) && town !== null,
      },
    };
  });
}

function assertOwnPhoto(ctx: OrgContext, photoKey: string): void {
  if (!photoKey.startsWith(`cats/${ctx.membership.organization.id}/`)) {
    throw new DomainError("VALIDATION", "Vuelve a subir la foto del gato");
  }
}

function values(data: CatInput) {
  return {
    colonyId: data.colonyId,
    name: data.name,
    sex: data.sex,
    birthDate: data.birthDate,
    birthDateApproximate: data.birthDate ? data.birthDateApproximate : false,
    sterilized: data.sterilized,
    description: data.description,
    photoKey: data.photoKey,
    latitude: data.latitude,
    longitude: data.longitude,
    municipalityCode: data.municipalityCode,
    address: data.address,
  };
}

const writeErrors = {
  VALIDATION: "La colonia elegida no es de tu asociación",
  FORBIDDEN:
    "Solo los gestores de la colonia y los administradores pueden añadir o editar sus gatos",
};

/** Cats of a colony are its managers' (and admins'); cats without colony, anyone's. */
async function assertCanPlaceIn(tx: TenantTx, colonyId: string | null) {
  if (colonyId !== null && !(await canManageColony(tx, colonyId))) {
    throw new DomainError("FORBIDDEN", writeErrors.FORBIDDEN);
  }
}

async function canEditCat(tx: TenantTx, id: string): Promise<boolean> {
  const result = await tx.execute<{ ok: boolean }>(sql`select app_can_edit_cat(${id}) as ok`);
  return result.rows[0]?.ok === true;
}

export async function createCat(ctx: OrgContext, data: CatInput) {
  assertAssociation(ctx);
  assertOwnPhoto(ctx, data.photoKey);
  return withTenant(ctx.user.id, async (tx) => {
    await assertCanPlaceIn(tx, data.colonyId);
    const [row] = await tx
      .insert(cats)
      .values({
        ...values(data),
        organizationId: ctx.membership.organization.id,
        createdBy: ctx.user.id,
      })
      .returning({ id: cats.id });
    return { id: row!.id };
  }).catch((error) => mapDbError(error, writeErrors));
}

export async function updateCat(ctx: OrgContext, id: string, data: CatInput) {
  assertAssociation(ctx);
  assertOwnPhoto(ctx, data.photoKey);
  const previousPhoto = await withTenant(ctx.user.id, async (tx) => {
    const [current] = await tx
      .select({ photoKey: cats.photoKey })
      .from(cats)
      .where(and(eq(cats.id, id), eq(cats.organizationId, ctx.membership.organization.id)));
    if (!current) throw new DomainError("NOT_FOUND", "El gato no existe");
    // RLS would silently skip the update: say why instead.
    if (!(await canEditCat(tx, id))) throw new DomainError("FORBIDDEN", writeErrors.FORBIDDEN);
    await assertCanPlaceIn(tx, data.colonyId);
    await tx.update(cats).set(values(data)).where(eq(cats.id, id));
    return current.photoKey;
  }).catch((error) => mapDbError(error, writeErrors));
  if (previousPhoto !== data.photoKey) await deletePhotoQuietly(previousPhoto);
  return { ok: true as const };
}

/** Admins only; the rest ask for it (deletions.ts). */
export async function deleteCat(ctx: OrgContext, id: string) {
  assertAssociation(ctx);
  assertCanDelete(ctx);
  const photoKey = await withTenant(ctx.user.id, (tx) => deleteCatIn(tx, ctx, id));
  await deletePhotoQuietly(photoKey);
  return { ok: true as const };
}

/** Returns the photo to delete from storage once the transaction commits. */
export async function deleteCatIn(tx: TenantTx, ctx: OrgContext, id: string): Promise<string> {
  const deleted = await tx
    .delete(cats)
    .where(and(eq(cats.id, id), eq(cats.organizationId, ctx.membership.organization.id)))
    .returning({ photoKey: cats.photoKey });
  if (!deleted.length) throw new DomainError("NOT_FOUND", "El gato no existe");
  return deleted[0]!.photoKey;
}

/** Colonies of the caller's association, for the cat and action forms. */
export function listColonyOptions(ctx: OrgContext) {
  return withTenant(ctx.user.id, (tx) =>
    tx
      .select({
        id: colonies.id,
        name: colonies.name,
        latitude: colonies.latitude,
        longitude: colonies.longitude,
        municipalityCode: colonies.municipalityCode,
        municipalityName: municipalities.name,
        address: colonies.address,
        /** Its cats can only be registered by its managers (and admins). */
        canManage: canManageColonySql(colonies.id),
      })
      .from(colonies)
      .innerJoin(municipalities, eq(municipalities.code, colonies.municipalityCode))
      .where(eq(colonies.organizationId, ctx.membership.organization.id))
      .orderBy(asc(colonies.name)),
  );
}

/* --------------------------------- Photos --------------------------------- */

/**
 * Stores a photo for a cat that is about to be created or edited. The type is taken
 * from the file's bytes, not from what the browser claims.
 */
export async function uploadCatPhoto(ctx: OrgContext, bytes: Uint8Array) {
  assertAssociation(ctx);
  const photoKey = await storeImage(bytes, `cats/${ctx.membership.organization.id}`, ctx.user.id);
  return { photoKey };
}

/** The photo of a cat the caller can see (RLS decides), or null. */
export async function getCatPhoto(ctx: OrgContext, id: string) {
  const [row] = await withTenant(ctx.user.id, (tx) =>
    tx.select({ photoKey: cats.photoKey }).from(cats).where(eq(cats.id, id)),
  );
  if (!row) return null;
  return getStorage().get(row.photoKey);
}

export const deletePhotoQuietly = deleteImageQuietly;
