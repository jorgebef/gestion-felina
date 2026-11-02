/**
 * Profile photos of people and organizations (cats use their main photo). Stored like cat
 * photos; the column only keeps the storage key, which clients also use as cache version.
 *
 *   * A person's photo: only they change it; whoever can see the person (RLS on users:
 *     themselves, their organization, the super admin) can see it.
 *   * An organization's photo (its logo): its admins change it; it is public, like the
 *     organization's name on an invitation page.
 */
import { eq } from "drizzle-orm";

import { getDb, organizations, users, withTenant } from "@felina/db";
import { getStorage } from "@felina/storage";

import { assertAdmin, DomainError, type OrgContext, type UserContext } from "./context.ts";
import { deleteImageQuietly, storeImage } from "./images.ts";

export async function setMyAvatar(ctx: UserContext, bytes: Uint8Array) {
  const key = await storeImage(bytes, `avatars/users/${ctx.user.id}`, ctx.user.id);
  const previous = await withTenant(ctx.user.id, async (tx) => {
    const [me] = await tx
      .select({ avatarKey: users.avatarKey })
      .from(users)
      .where(eq(users.id, ctx.user.id));
    await tx.update(users).set({ avatarKey: key }).where(eq(users.id, ctx.user.id));
    return me?.avatarKey ?? null;
  });
  await deleteImageQuietly(previous);
  return { avatar: key };
}

export async function removeMyAvatar(ctx: UserContext) {
  const previous = await withTenant(ctx.user.id, async (tx) => {
    const [me] = await tx
      .select({ avatarKey: users.avatarKey })
      .from(users)
      .where(eq(users.id, ctx.user.id));
    await tx.update(users).set({ avatarKey: null }).where(eq(users.id, ctx.user.id));
    return me?.avatarKey ?? null;
  });
  await deleteImageQuietly(previous);
  return { ok: true as const };
}

/** A person's photo, if the caller can see that person (RLS decides). */
export async function getUserAvatar(ctx: UserContext, userId: string) {
  const [row] = await withTenant(ctx.user.id, (tx) =>
    tx.select({ avatarKey: users.avatarKey }).from(users).where(eq(users.id, userId)),
  );
  return row?.avatarKey ? getStorage().get(row.avatarKey) : null;
}

/** Admins change their organization's photo; `bytes` null removes it. */
export async function setOrganizationAvatar(ctx: OrgContext, bytes: Uint8Array | null) {
  assertAdmin(ctx);
  const orgId = ctx.membership.organization.id;
  const key = bytes ? await storeImage(bytes, `avatars/organizations/${orgId}`, ctx.user.id) : null;
  const previous = await withTenant(ctx.user.id, async (tx) => {
    const [org] = await tx
      .select({ avatarKey: organizations.avatarKey })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    const updated = await tx
      .update(organizations)
      .set({ avatarKey: key })
      .where(eq(organizations.id, orgId))
      .returning({ id: organizations.id });
    if (!updated.length) throw new DomainError("FORBIDDEN", "No puedes cambiar esta organización");
    return org?.avatarKey ?? null;
  }).catch(async (error) => {
    await deleteImageQuietly(key);
    throw error;
  });
  await deleteImageQuietly(previous);
  return { avatar: key };
}

/** Any organization's photo (public, like its name). */
export async function getOrganizationAvatar(organizationId: string) {
  const [row] = await getDb()
    .select({ avatarKey: organizations.avatarKey })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  return row?.avatarKey ? getStorage().get(row.avatarKey) : null;
}
