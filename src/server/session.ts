import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth, isGoogleAuthEnabled } from "#/lib/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

async function readSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

export const getSessionUser = createServerFn({ method: "GET" }).handler(() => readSessionUser());

export const getAuthConfig = createServerFn({ method: "GET" }).handler(() => ({
  googleEnabled: isGoogleAuthEnabled,
}));

/** Rejects the call unless a user is signed in, and exposes their id to the handler. */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await readSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return next({ context: { user } });
});

/** Exposes the signed-in user (or null) without rejecting anonymous visitors. */
export const optionalAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => next({ context: { user: await readSessionUser() } }),
);
