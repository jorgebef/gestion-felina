import { createMiddleware } from "hono/factory";

import {
  DomainError,
  readActiveCompany,
  type CompanyContext,
  type SessionUser,
  type UserContext,
} from "@licita/core/context";

import { auth } from "./auth.ts";

/** Signed-in user from the Better Auth session cookie, or null. */
export async function sessionUser(headers: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name: name ?? "", email };
}

/** Rejects anonymous calls; exposes `c.var.ctx.user`. */
export const requireUser = createMiddleware<{ Variables: { ctx: UserContext } }>(
  async (c, next) => {
    const user = await sessionUser(c.req.raw.headers);
    if (!user) throw new DomainError("UNAUTHORIZED");
    c.set("ctx", { user });
    await next();
  },
);

/** Rejects calls from users without a company; exposes `c.var.ctx.user` and `.company`. */
export const requireCompany = createMiddleware<{ Variables: { ctx: CompanyContext } }>(
  async (c, next) => {
    const user = await sessionUser(c.req.raw.headers);
    if (!user) throw new DomainError("UNAUTHORIZED");
    const company = await readActiveCompany(user.id);
    if (!company) throw new DomainError("NO_COMPANY");
    c.set("ctx", { user, company });
    await next();
  },
);

/**
 * Hook for `zValidator(target, schema, onInvalid)`: validation failures go through the
 * API's error format (see ./errors.ts) instead of zValidator's default body.
 */
export function onInvalid(
  result: { success: true } | { success: false; error: { issues: { message: string }[] } },
): void {
  if (!result.success) {
    throw new DomainError("VALIDATION", result.error.issues[0]?.message ?? "Datos no válidos");
  }
}
