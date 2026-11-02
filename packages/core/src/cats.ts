/** Cats: registered by association members; visible to the town hall of their municipality. */
import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";

import {
  actionCats,
  actions,
  cats,
  colonies,
  municipalities,
  organizations,
  withTenant,
} from "@felina/db";
import { getStorage } from "@felina/storage";
import {
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  type CatInput,
  type CatListQuery,
  type PhotoType,
} from "@felina/schemas/cat";

import {
  assertAssociation,
  DomainError,
  isAdmin,
  isTownHall,
  mapDbError,
  type OrgContext,
} from "./context.ts";

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
    const { createdBy, photoKey, ...rest } = cat;
    return {
      cat: rest,
      /** Only for the managing association (needed to keep the photo when editing). */
      photoKey: mine ? photoKey : null,
      actions: history,
      permissions: {
        canEdit: mine,
        canDelete: mine && (isAdmin(ctx) || createdBy === ctx.user.id),
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

const writeErrors = { VALIDATION: "La colonia elegida no es de tu asociación" };

export async function createCat(ctx: OrgContext, data: CatInput) {
  assertAssociation(ctx);
  assertOwnPhoto(ctx, data.photoKey);
  return withTenant(ctx.user.id, async (tx) => {
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
    await tx.update(cats).set(values(data)).where(eq(cats.id, id));
    return current.photoKey;
  }).catch((error) => mapDbError(error, writeErrors));
  if (previousPhoto !== data.photoKey) await deletePhotoQuietly(previousPhoto);
  return { ok: true as const };
}

export async function deleteCat(ctx: OrgContext, id: string) {
  assertAssociation(ctx);
  const photoKey = await withTenant(ctx.user.id, async (tx) => {
    const deleted = await tx
      .delete(cats)
      .where(and(eq(cats.id, id), eq(cats.organizationId, ctx.membership.organization.id)))
      .returning({ photoKey: cats.photoKey });
    if (!deleted.length) {
      throw new DomainError(
        "FORBIDDEN",
        "Solo los administradores o quien registró el gato pueden eliminarlo",
      );
    }
    return deleted[0]!.photoKey;
  });
  await deletePhotoQuietly(photoKey);
  return { ok: true as const };
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
      })
      .from(colonies)
      .innerJoin(municipalities, eq(municipalities.code, colonies.municipalityCode))
      .where(eq(colonies.organizationId, ctx.membership.organization.id))
      .orderBy(asc(colonies.name)),
  );
}

/* --------------------------------- Photos --------------------------------- */

function sniffImageType(bytes: Uint8Array): PhotoType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Stores a photo for a cat that is about to be created or edited. The type is taken
 * from the file's bytes, not from what the browser claims.
 */
export async function uploadCatPhoto(ctx: OrgContext, bytes: Uint8Array) {
  assertAssociation(ctx);
  if (bytes.byteLength === 0) throw new DomainError("VALIDATION", "El archivo está vacío");
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new DomainError("VALIDATION", "La foto no puede superar los 8 MB");
  }
  const type = sniffImageType(bytes);
  if (!type) throw new DomainError("VALIDATION", "La foto debe ser JPG, PNG o WebP");
  const key = `cats/${ctx.membership.organization.id}/${randomUUID()}.${PHOTO_TYPES[type]}`;
  await getStorage().put({
    key,
    body: bytes,
    contentType: type,
    metadata: { uploadedBy: ctx.user.id },
  });
  return { photoKey: key };
}

/** The photo of a cat the caller can see (RLS decides), or null. */
export async function getCatPhoto(ctx: OrgContext, id: string) {
  const [row] = await withTenant(ctx.user.id, (tx) =>
    tx.select({ photoKey: cats.photoKey }).from(cats).where(eq(cats.id, id)),
  );
  if (!row) return null;
  return getStorage().get(row.photoKey);
}

async function deletePhotoQuietly(key: string): Promise<void> {
  try {
    await getStorage().delete(key);
  } catch (error) {
    console.error(`[storage] could not delete ${key}`, error);
  }
}
