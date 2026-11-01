import { createMiddleware } from "hono/factory";

import {
  DomainError,
  readViewer,
  type OrgContext,
  type SessionUser,
  type UserContext,
} from "@felina/core/context";

import { auth } from "./auth.ts";

/** Signed-in user from the Better Auth session cookie, or null. */
export async function sessionUser(headers: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name: name ?? "", email };
}

/** Rejects anonymous calls; exposes `c.var.ctx`. */
export const requireUser = createMiddleware<{ Variables: { ctx: UserContext } }>(
  async (c, next) => {
    const user = await sessionUser(c.req.raw.headers);
    if (!user) throw new DomainError("UNAUTHORIZED");
    const { isPlatformAdmin } = await readViewer(user.id);
    c.set("ctx", { user, isPlatformAdmin });
    await next();
  },
);

/** Only the super admin. */
export const requirePlatformAdmin = createMiddleware<{ Variables: { ctx: UserContext } }>(
  async (c, next) => {
    const user = await sessionUser(c.req.raw.headers);
    if (!user) throw new DomainError("UNAUTHORIZED");
    const { isPlatformAdmin } = await readViewer(user.id);
    if (!isPlatformAdmin) throw new DomainError("FORBIDDEN", "Solo para el superadministrador");
    c.set("ctx", { user, isPlatformAdmin });
    await next();
  },
);

/** Members of an approved organization; exposes `c.var.ctx.membership`. */
export const requireOrg = createMiddleware<{ Variables: { ctx: OrgContext } }>(async (c, next) => {
  const user = await sessionUser(c.req.raw.headers);
  if (!user) throw new DomainError("UNAUTHORIZED");
  const { isPlatformAdmin, membership } = await readViewer(user.id);
  if (!membership) throw new DomainError("NO_ORGANIZATION", "No perteneces a ninguna organización");
  if (membership.organization.status !== "approved") {
    throw new DomainError("ORGANIZATION_NOT_APPROVED", "Tu organización todavía no está aprobada");
  }
  c.set("ctx", { user, isPlatformAdmin, membership });
  await next();
});

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
