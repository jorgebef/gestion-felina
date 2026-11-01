/**
 * Who is calling. The API resolves these from the Better Auth session; every service
 * in this package receives them explicitly and runs its queries through `withTenant`,
 * so PostgreSQL row-level security scopes the data to the caller's organization.
 */
import { eq } from "drizzle-orm";

import { municipalities, organizationMembers, organizations, users, withTenant } from "@felina/db";
import type { MemberRole, OrganizationKind, OrganizationStatus } from "@felina/domain/felina";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface Membership {
  role: MemberRole;
  organization: {
    id: string;
    kind: OrganizationKind;
    name: string;
    status: OrganizationStatus;
    reviewNote: string | null;
    municipalityCode: string | null;
    municipalityName: string | null;
  };
}

export interface UserContext {
  user: SessionUser;
  isPlatformAdmin: boolean;
}

/** A member of an approved organization. */
export interface OrgContext extends UserContext {
  membership: Membership;
}

export const ERROR_CODES = [
  "UNAUTHORIZED",
  "NO_ORGANIZATION",
  "ORGANIZATION_NOT_APPROVED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Expected failures; the API maps the code to an HTTP status. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** The caller's single organization (in any state) and their platform-admin flag. */
export async function readViewer(
  userId: string,
): Promise<{ isPlatformAdmin: boolean; membership: Membership | null }> {
  return withTenant(userId, async (tx) => {
    const [me] = await tx
      .select({ isPlatformAdmin: users.isPlatformAdmin })
      .from(users)
      .where(eq(users.id, userId));
    const [row] = await tx
      .select({
        role: organizationMembers.role,
        id: organizations.id,
        kind: organizations.kind,
        name: organizations.name,
        status: organizations.status,
        reviewNote: organizations.reviewNote,
        municipalityCode: organizations.municipalityCode,
        municipalityName: municipalities.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .leftJoin(municipalities, eq(municipalities.code, organizations.municipalityCode))
      .where(eq(organizationMembers.userId, userId));
    return {
      isPlatformAdmin: me?.isPlatformAdmin ?? false,
      membership: row
        ? {
            role: row.role,
            organization: {
              id: row.id,
              kind: row.kind,
              name: row.name,
              status: row.status,
              reviewNote: row.reviewNote,
              municipalityCode: row.municipalityCode,
              municipalityName: row.municipalityName,
            },
          }
        : null,
    };
  });
}

export function isAdmin(ctx: OrgContext): boolean {
  return ctx.membership.role === "admin";
}

export function isAssociation(ctx: OrgContext): boolean {
  return ctx.membership.organization.kind === "association";
}

export function isTownHall(ctx: OrgContext): boolean {
  return ctx.membership.organization.kind === "town_hall";
}

export function assertAdmin(ctx: OrgContext): void {
  if (!isAdmin(ctx)) {
    throw new DomainError(
      "FORBIDDEN",
      "Solo los administradores de la organización pueden hacerlo",
    );
  }
}

export function assertAssociation(ctx: OrgContext): void {
  if (!isAssociation(ctx)) {
    throw new DomainError(
      "FORBIDDEN",
      "Solo las asociaciones gestionan colonias, gatos y acciones",
    );
  }
}

export function assertTownHall(ctx: OrgContext): void {
  if (!isTownHall(ctx)) throw new DomainError("FORBIDDEN", "Solo para ayuntamientos");
}

export function assertPlatformAdmin(ctx: UserContext): void {
  if (!ctx.isPlatformAdmin) throw new DomainError("FORBIDDEN", "Solo para el superadministrador");
}

/**
 * Translates PostgreSQL errors raised by RLS, triggers and the SECURITY DEFINER
 * functions (see packages/db/migrations) into domain errors. Anything else is rethrown.
 */
export function mapDbError(
  error: unknown,
  messages: Partial<Record<ErrorCode, string>> = {},
): never {
  if (error instanceof DomainError) throw error;
  const cause = (error as { cause?: { code?: string; message?: string } }).cause ?? error;
  const { code, message = "" } = cause as { code?: string; message?: string };
  if (code === "42501")
    throw new DomainError("FORBIDDEN", messages.FORBIDDEN ?? "No tienes permiso");
  if (code === "P0002") throw new DomainError("NOT_FOUND", messages.NOT_FOUND ?? "No encontrado");
  if (code === "23505") {
    throw new DomainError("CONFLICT", messages.CONFLICT ?? "Ya existe un registro igual");
  }
  if (code === "23514" || code === "23503" || code === "22023") {
    throw new DomainError("VALIDATION", messages.VALIDATION ?? `Datos no válidos (${message})`);
  }
  throw error;
}
