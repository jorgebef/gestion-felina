/**
 * HTTP API. Browsers reach it through the web app's same-origin `/api` proxy; other
 * clients (a future mobile app, scripts) can call it directly.
 *
 *   /api/auth/*   Better Auth (email + password, Google, password reset)
 *   /api/v1/*     application API, typed for `@felina/api-client`
 *   /health       liveness probe
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { MAX_PHOTO_BYTES } from "@felina/schemas/cat";

import { auth } from "./auth.ts";
import { apiEnv } from "./env.ts";
import { errorResponse, handleError } from "./errors.ts";
import {
  invitationRoutes,
  meRoutes,
  municipalityRoutes,
  organizationRoutes,
  publicRoutes,
} from "./routes/account.ts";
import { actionRoutes, dashboardRoutes } from "./routes/actions.ts";
import { adminRoutes } from "./routes/admin.ts";
import { catRoutes, colonyRoutes, proposalRoutes, uploadRoutes } from "./routes/colonies.ts";

/** Application API mounted at /api/v1. Its type drives `@felina/api-client`. */
export const v1Routes = new Hono()
  .route("/public", publicRoutes)
  .route("/me", meRoutes)
  .route("/organizations", organizationRoutes)
  .route("/invitations", invitationRoutes)
  .route("/municipalities", municipalityRoutes)
  .route("/colonies", colonyRoutes)
  .route("/cats", catRoutes)
  .route("/uploads", uploadRoutes)
  .route("/actions", actionRoutes)
  .route("/proposals", proposalRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/admin", adminRoutes);

export type ApiRoutes = typeof v1Routes;

export function createApp(options: { log?: boolean } = {}) {
  const env = apiEnv();
  const origins = [
    env.APP_URL,
    ...(env.TRUSTED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ];

  const app = new Hono();
  if (options.log) app.use(logger());
  app.use(secureHeaders());
  app.onError(handleError);
  app.notFound((c) => errorResponse(c, "NOT_FOUND", "Ruta no encontrada"));

  app.get("/health", (c) => c.json({ ok: true }));

  // Cross-origin browser clients must be listed; same-origin calls via the proxy pass.
  app.use("/api/*", cors({ origin: origins, credentials: true }));
  app.use("/api/*", csrf({ origin: origins }));
  // 1 MB per request, except photo uploads.
  const photoLimit = bodyLimit({ maxSize: MAX_PHOTO_BYTES + 64 * 1024 });
  const defaultLimit = bodyLimit({ maxSize: 1024 * 1024 });
  app.use("/api/*", (c, next) =>
    c.req.path === "/api/v1/uploads/photos" ? photoLimit(c, next) : defaultLimit(c, next),
  );

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.route("/api/v1", v1Routes);
  return app;
}
