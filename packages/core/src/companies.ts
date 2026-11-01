import { eq, sql } from "drizzle-orm";

import { companies, companySubscriptions, users, withTenant } from "@licita/db";
import type { CompanyInput, UserProfileInput } from "@licita/schemas/company";

import {
  assertCanManageCompany,
  DomainError,
  readActiveCompany,
  type CompanyContext,
  type UserContext,
} from "./context.ts";

/** Onboarding: creates the company with the current user as owner (see app_create_company). */
export async function createCompany(ctx: UserContext, data: CompanyInput) {
  const existing = await readActiveCompany(ctx.user.id);
  if (existing) return { id: existing.id };
  return withTenant(ctx.user.id, async (tx) => {
    const result = await tx.execute<{ id: string }>(
      sql`select app_create_company(${data.legalName}, ${data.displayName ?? null},
            ${data.businessDescription ?? null}, ${data.companyType ?? null},
            ${data.baseProvinceCode ?? null}, ${data.baseMunicipality ?? null},
            ${data.taxId ?? null}) as id`,
    );
    return { id: result.rows[0]!.id };
  });
}

export function getCompanySettings(ctx: CompanyContext) {
  return withTenant(ctx.user.id, async (tx) => {
    const [company] = await tx.select().from(companies).where(eq(companies.id, ctx.company.id));
    const [subscription] = await tx
      .select({
        planCode: companySubscriptions.planCode,
        status: companySubscriptions.status,
        currentPeriodEnd: companySubscriptions.currentPeriodEnd,
      })
      .from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, ctx.company.id));
    const [me] = await tx
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, ctx.user.id));
    if (!company) throw new DomainError("NOT_FOUND");
    return {
      company: {
        legalName: company.legalName,
        displayName: company.displayName,
        companyType: company.companyType,
        baseProvinceCode: company.baseProvinceCode?.trim() ?? null,
        baseMunicipality: company.baseMunicipality,
        businessDescription: company.businessDescription,
        taxId: company.taxId,
      },
      role: ctx.company.role,
      subscription: subscription ?? null,
      me: me ?? { fullName: ctx.user.name, email: ctx.user.email },
    };
  });
}

export async function updateCompany(ctx: CompanyContext, data: CompanyInput) {
  assertCanManageCompany(ctx.company);
  await withTenant(ctx.user.id, (tx) =>
    tx
      .update(companies)
      .set({
        legalName: data.legalName,
        displayName: data.displayName ?? null,
        companyType: data.companyType ?? null,
        baseProvinceCode: data.baseProvinceCode ?? null,
        baseMunicipality: data.baseMunicipality ?? null,
        businessDescription: data.businessDescription ?? null,
        taxId: data.taxId ?? null,
      })
      .where(eq(companies.id, ctx.company.id)),
  );
  return { ok: true as const };
}

export async function updateMyProfile(ctx: UserContext, data: UserProfileInput) {
  await withTenant(ctx.user.id, (tx) =>
    tx.update(users).set({ fullName: data.fullName }).where(eq(users.id, ctx.user.id)),
  );
  return { ok: true as const };
}
