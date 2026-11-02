/** Super-admin area: review organizations and register town halls. */
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  getDb,
  municipalities,
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
  withTenant,
} from "@felina/db";
import { sendSafely } from "@felina/notifications/mailer";
import { organizationReviewedEmail } from "@felina/notifications/templates";
import type {
  InvitationInput,
  OrganizationListQuery,
  OrganizationReview,
  TownHallCreate,
} from "@felina/schemas/organization";

import { assertPlatformAdmin, DomainError, mapDbError, type UserContext } from "./context.ts";
import { withInvitationUrl } from "./invitation-links.ts";
import { createInvitationIn } from "./organizations.ts";

export function listOrganizations(ctx: UserContext, query: OrganizationListQuery) {
  assertPlatformAdmin(ctx);
  return withTenant(ctx.user.id, async (tx) => {
    const filters: (SQL | undefined)[] = [
      query.status ? eq(organizations.status, query.status) : undefined,
      query.kind ? eq(organizations.kind, query.kind) : undefined,
      query.q
        ? or(ilike(organizations.name, `%${query.q}%`), ilike(municipalities.name, `%${query.q}%`))
        : undefined,
    ];
    const items = await tx
      .select({
        id: organizations.id,
        kind: organizations.kind,
        name: organizations.name,
        status: organizations.status,
        municipalityCode: organizations.municipalityCode,
        municipalityName: municipalities.name,
        contactEmail: organizations.contactEmail,
        createdAt: organizations.createdAt,
        reviewedAt: organizations.reviewedAt,
        members: sql<number>`(select count(*) from ${organizationMembers}
          where ${organizationMembers.organizationId} = ${organizations.id})`.mapWith(Number),
        openInvitations: sql<number>`(select count(*) from ${organizationInvitations}
          where ${organizationInvitations.organizationId} = ${organizations.id}
            and ${organizationInvitations.acceptedAt} is null
            and ${organizationInvitations.revokedAt} is null
            and ${organizationInvitations.expiresAt} > now())`.mapWith(Number),
      })
      .from(organizations)
      .leftJoin(municipalities, eq(municipalities.code, organizations.municipalityCode))
      .where(and(...filters))
      .orderBy(sql`${organizations.status} = 'pending' desc`, desc(organizations.createdAt))
      .limit(200);
    const counts = await tx
      .select({ status: organizations.status, n: sql<number>`count(*)`.mapWith(Number) })
      .from(organizations)
      .groupBy(organizations.status);
    return {
      items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>,
    };
  });
}

export function getOrganizationDetail(ctx: UserContext, id: string) {
  assertPlatformAdmin(ctx);
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
        reviewNote: organizations.reviewNote,
        reviewedAt: organizations.reviewedAt,
        municipalityCode: organizations.municipalityCode,
        municipalityName: municipalities.name,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .leftJoin(municipalities, eq(municipalities.code, organizations.municipalityCode))
      .where(eq(organizations.id, id));
    if (!org) throw new DomainError("NOT_FOUND", "La organización no existe");
    const members = await tx
      .select({
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        name: users.fullName,
        email: users.email,
        joinedAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, id))
      .orderBy(asc(organizationMembers.createdAt));
    const invitations = await tx
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
          eq(organizationInvitations.organizationId, id),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt),
        ),
      )
      .orderBy(desc(organizationInvitations.createdAt));
    return { organization: org, members, invitations: invitations.map(withInvitationUrl) };
  });
}

export async function reviewOrganization(ctx: UserContext, id: string, data: OrganizationReview) {
  assertPlatformAdmin(ctx);
  const org = await withTenant(ctx.user.id, async (tx) => {
    await tx.execute(sql`select app_review_organization(${id}, ${data.status}, ${data.note})`);
    const [row] = await tx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, id));
    return row!;
  }).catch((error) => mapDbError(error, { NOT_FOUND: "La organización no existe" }));

  // Tell the organization's admins (owner connection: their emails are not shared).
  const admins = await getDb()
    .select({ email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(and(eq(organizationMembers.organizationId, id), eq(organizationMembers.role, "admin")));
  await Promise.all(
    admins.map((a) =>
      sendSafely(
        organizationReviewedEmail({
          to: a.email,
          organizationName: org.name,
          status: data.status,
          note: data.note,
        }),
      ),
    ),
  );
  return { ok: true as const };
}

/**
 * Town halls cannot sign up: the super admin registers the one of a municipality
 * (approved from the start) and invites its first administrator.
 */
export async function createTownHall(ctx: UserContext, data: TownHallCreate) {
  assertPlatformAdmin(ctx);
  const result = await withTenant(ctx.user.id, async (tx) => {
    const [municipality] = await tx
      .select({ name: municipalities.name })
      .from(municipalities)
      .where(eq(municipalities.code, data.municipalityCode));
    if (!municipality) throw new DomainError("VALIDATION", "Municipio no válido");
    const name = data.name ?? `Ayuntamiento de ${municipality.name}`;
    const [org] = await tx
      .insert(organizations)
      .values({
        kind: "town_hall",
        name,
        municipalityCode: data.municipalityCode,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: ctx.user.id,
        createdBy: ctx.user.id,
      })
      .returning({ id: organizations.id });
    const invitation = await createInvitationIn(
      tx,
      ctx.user,
      { id: org!.id, name },
      { email: data.adminEmail, role: "admin" },
    );
    return { id: org!.id, invitation };
  }).catch((error) =>
    mapDbError(error, { CONFLICT: "Ese municipio ya tiene un ayuntamiento registrado" }),
  );
  const emailSent = await result.invitation.send();
  return { id: result.id, emailSent };
}

/** Super admin: (re)invite someone to any organization, e.g. a town hall's admin. */
export async function inviteToOrganization(ctx: UserContext, orgId: string, data: InvitationInput) {
  assertPlatformAdmin(ctx);
  const invitation = await withTenant(ctx.user.id, async (tx) => {
    const [org] = await tx
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    if (!org) throw new DomainError("NOT_FOUND", "La organización no existe");
    return createInvitationIn(tx, ctx.user, org, data);
  }).catch((error) => mapDbError(error));
  const emailSent = await invitation.send();
  return { id: invitation.id, emailSent };
}
