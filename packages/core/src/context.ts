/**
 * Who is calling. The API resolves these from the Better Auth session; every service
 * in this package receives them explicitly and runs its queries through `withTenant`,
 * so PostgreSQL row-level security scopes the data to the caller's companies.
 */
import { asc, eq, sql } from "drizzle-orm";

import { companies, companyMembers, withTenant, type MemberRole } from "@licita/db";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface ActiveCompany {
  id: string;
  name: string;
  role: MemberRole;
}

export interface UserContext {
  user: SessionUser;
}

export interface CompanyContext extends UserContext {
  company: ActiveCompany;
}

export const ERROR_CODES = [
  "UNAUTHORIZED",
  "NO_COMPANY",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
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

/**
 * The company the user is working in. Users can belong to several companies; until a
 * company switcher exists, the oldest membership is the active one.
 */
export async function readActiveCompany(userId: string): Promise<ActiveCompany | null> {
  return withTenant(userId, async (tx) => {
    const [row] = await tx
      .select({
        id: companies.id,
        name: sql<string>`coalesce(${companies.displayName}, ${companies.legalName})`,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(eq(companyMembers.userId, userId))
      .orderBy(asc(companyMembers.createdAt))
      .limit(1);
    return row ?? null;
  });
}

export function assertCanManageCompany(company: ActiveCompany): void {
  if (company.role !== "owner" && company.role !== "admin") throw new DomainError("FORBIDDEN");
}
