/** Association sign-up, organization settings, members and invitations. */
import { createHash, randomBytes } from "node:crypto";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import {
  getDb,
  municipalities,
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
  withTenant,
  type TenantTx,
} from "@felina/db";
import type { MemberRole } from "@felina/domain/felina";
import { sendSafely } from "@felina/notifications/mailer";
import { invitationEmail, newOrganizationEmail } from "@felina/notifications/templates";
import type {
  AssociationRegistration,
  InvitationInput,
  OrganizationUpdate,
  UserProfileInput,
} from "@felina/schemas/organization";

import {
  assertAdmin,
  DomainError,
  mapDbError,
  readViewer,
  type OrgContext,
  type UserContext,
} from "./context.ts";
import { invitationUrl, sealInvitationToken, withInvitationUrl } from "./invitation-links.ts";

export const INVITATION_DAYS = 14;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ------------------------------ Registration ------------------------------ */

/** The caller registers an association, pending approval, and becomes its admin. */
export async function registerAssociation(ctx: UserContext, data: AssociationRegistration) {
  const { membership } = await readViewer(ctx.user.id);
  if (membership) {
    throw new DomainError("CONFLICT", "Ya perteneces a una organización");
  }
  const id = await withTenant(ctx.user.id, async (tx) => {
    const result = await tx.execute<{ id: string }>(
      sql`select app_register_association(${data.name}, ${data.taxId}, ${data.municipalityCode},
            ${data.description}, ${data.contactEmail}, ${data.contactPhone}) as id`,
    );
    return result.rows[0]!.id;
  }).catch((error) => mapDbError(error, { CONFLICT: "Ya perteneces a una organización" }));

  // Let the platform admins know there is something to review.
  const admins = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.isPlatformAdmin, true));
  await Promise.all(
    admins.map((a) =>
      sendSafely(newOrganizationEmail({ to: a.email, organizationName: data.name })),
    ),
  );
  return { id };
}

/* ------------------------------ Settings ---------------------------------- */

export function getMyOrganization(ctx: OrgContext) {
  return withTenant(ctx.user.id, async (tx) => {
    const [org] = await tx
      .select({
        id: organizations.id,
        kind: organizations.kind,
        name: organizations.name,
        taxId: organizations.taxId,
        description: organizations.description,
        contactEmail: organizations.contactEmail,
        contactPhone: organizations.contactPhone,
        status: organizations.status,
        municipalityCode: organizations.municipalityCode,
        municipalityName: municipalities.name,
        createdAt: organizations.createdAt,
        reviewedAt: organizations.reviewedAt,
        avatar: organizations.avatarKey,
      })
      .from(organizations)
      .leftJoin(municipalities, eq(municipalities.code, organizations.municipalityCode))
      .where(eq(organizations.id, ctx.membership.organization.id));
    if (!org) throw new DomainError("NOT_FOUND");
    return { organization: org, role: ctx.membership.role };
  });
}

export async function updateMyOrganization(ctx: OrgContext, data: OrganizationUpdate) {
  assertAdmin(ctx);
  await withTenant(ctx.user.id, (tx) =>
    tx
      .update(organizations)
      .set({
        name: data.name,
        taxId: data.taxId,
        description: data.description,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
      })
      .where(eq(organizations.id, ctx.membership.organization.id)),
  );
  return { ok: true as const };
}

/** The caller's own account: what the profile page shows besides the session data. */
export function getMyProfile(ctx: UserContext) {
  return withTenant(ctx.user.id, async (tx) => {
    const [me] = await tx
      .select({ fullName: users.fullName, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, ctx.user.id));
    if (!me) throw new DomainError("NOT_FOUND");
    const [member] = await tx
      .select({ joinedAt: organizationMembers.createdAt })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, ctx.user.id));
    return {
      fullName: me.fullName ?? "",
      email: me.email,
      createdAt: me.createdAt,
      joinedAt: member?.joinedAt ?? null,
    };
  });
}

export async function updateMyProfile(ctx: UserContext, data: UserProfileInput) {
  await withTenant(ctx.user.id, (tx) =>
    tx.update(users).set({ fullName: data.fullName }).where(eq(users.id, ctx.user.id)),
  );
  return { ok: true as const };
}

/* ------------------------------ Members ----------------------------------- */

export function listMembers(ctx: OrgContext) {
  return withTenant(ctx.user.id, (tx) =>
    tx
      .select({
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        joinedAt: organizationMembers.createdAt,
        name: users.fullName,
        email: users.email,
        avatar: users.avatarKey,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, ctx.membership.organization.id))
      .orderBy(asc(users.fullName), asc(users.email)),
  );
}

export async function setMemberRole(ctx: OrgContext, userId: string, role: MemberRole) {
  assertAdmin(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(organizationMembers)
      .set({ role })
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, ctx.membership.organization.id),
        ),
      )
      .returning({ userId: organizationMembers.userId });
    if (!updated.length) throw new DomainError("NOT_FOUND", "Esa persona no es de tu organización");
    return { ok: true as const };
  }).catch((error) =>
    mapDbError(error, { VALIDATION: "La organización debe tener al menos un administrador" }),
  );
}

/** Admins remove members; anyone can remove themselves (leave the organization). */
export async function removeMember(ctx: OrgContext, userId: string) {
  if (userId !== ctx.user.id) assertAdmin(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const deleted = await tx
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, ctx.membership.organization.id),
        ),
      )
      .returning({ userId: organizationMembers.userId });
    if (!deleted.length) throw new DomainError("NOT_FOUND", "Esa persona no es de tu organización");
    return { ok: true as const };
  }).catch((error) =>
    mapDbError(error, { VALIDATION: "La organización debe tener al menos un administrador" }),
  );
}

/* ------------------------------ Invitations ------------------------------- */

/**
 * Creates an invitation and emails the link. Used by organization admins for their own
 * organization and by the platform admin for any organization (e.g. a new town hall).
 * Re-inviting the same email replaces the previous open invitation.
 */
export async function createInvitationIn(
  tx: TenantTx,
  inviter: { id: string; name: string },
  organization: { id: string; name: string },
  data: InvitationInput,
) {
  const [alreadyMember] = await tx
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        sql`lower(${users.email}) = ${data.email}`,
      ),
    );
  if (alreadyMember) throw new DomainError("CONFLICT", "Esa persona ya es de la organización");

  await tx
    .update(organizationInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(organizationInvitations.organizationId, organization.id),
        eq(organizationInvitations.email, data.email),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
      ),
    );
  const token = randomBytes(32).toString("base64url");
  const [invitation] = await tx
    .insert(organizationInvitations)
    .values({
      organizationId: organization.id,
      email: data.email,
      role: data.role,
      tokenHash: hashToken(token),
      tokenCiphertext: sealInvitationToken(token),
      invitedBy: inviter.id,
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 86_400_000),
    })
    .returning({ id: organizationInvitations.id });
  return {
    id: invitation!.id,
    send: () =>
      sendSafely(
        invitationEmail({
          to: data.email,
          organizationName: organization.name,
          inviterName: inviter.name || null,
          role: data.role,
          url: invitationUrl(token),
          expiresInDays: INVITATION_DAYS,
        }),
      ),
  };
}

export async function inviteMember(ctx: OrgContext, data: InvitationInput) {
  assertAdmin(ctx);
  const invitation = await withTenant(ctx.user.id, (tx) =>
    createInvitationIn(tx, ctx.user, ctx.membership.organization, data),
  ).catch((error) => mapDbError(error));
  const emailSent = await invitation.send();
  return { id: invitation.id, emailSent };
}

export async function listInvitations(ctx: OrgContext) {
  assertAdmin(ctx);
  const rows = await withTenant(ctx.user.id, (tx) =>
    tx
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        expiresAt: organizationInvitations.expiresAt,
        createdAt: organizationInvitations.createdAt,
        tokenCiphertext: organizationInvitations.tokenCiphertext,
      })
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, ctx.membership.organization.id),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt),
        ),
      )
      .orderBy(desc(organizationInvitations.createdAt)),
  );
  return rows.map(withInvitationUrl);
}

export async function revokeInvitation(ctx: UserContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(organizationInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(organizationInvitations.id, id),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt),
        ),
      )
      .returning({ id: organizationInvitations.id });
    if (!updated.length) throw new DomainError("NOT_FOUND", "La invitación ya no está abierta");
    return { ok: true as const };
  });
}

export type InvitationState = "valid" | "expired" | "accepted" | "revoked";

/** Public preview behind an invitation link (the token is the credential). */
export async function getInvitationPreview(token: string) {
  const [row] = await getDb()
    .select({
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      expiresAt: organizationInvitations.expiresAt,
      acceptedAt: organizationInvitations.acceptedAt,
      revokedAt: organizationInvitations.revokedAt,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationKind: organizations.kind,
      organizationAvatar: organizations.avatarKey,
    })
    .from(organizationInvitations)
    .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .where(eq(organizationInvitations.tokenHash, hashToken(token)));
  if (!row) throw new DomainError("NOT_FOUND", "La invitación no existe");
  const state: InvitationState = row.revokedAt
    ? "revoked"
    : row.acceptedAt
      ? "accepted"
      : row.expiresAt < new Date()
        ? "expired"
        : "valid";
  return {
    email: row.email,
    role: row.role,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationKind: row.organizationKind,
    organizationAvatar: row.organizationAvatar,
    state,
  };
}

export async function acceptInvitation(ctx: UserContext, token: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const result = await tx.execute<{ id: string }>(
      sql`select app_accept_invitation(${hashToken(token)}) as id`,
    );
    return { organizationId: result.rows[0]!.id };
  }).catch((error) =>
    mapDbError(error, {
      NOT_FOUND: "La invitación no es válida o ha caducado",
      FORBIDDEN: "La invitación se envió a otro email. Inicia sesión con ese email.",
      CONFLICT: "Ya perteneces a una organización",
    }),
  );
}
