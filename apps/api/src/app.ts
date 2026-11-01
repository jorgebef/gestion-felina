/**
 * HTTP API. Browsers reach it through the web app's same-origin `/api` proxy; other
 * clients (a future mobile app, scripts) can call it directly.
 *
 *   /api/auth/*   Better Auth (email + password, Google, password reset)
 *   /api/v1/*     application API, typed for `@licita/api-client`
 *   /health       liveness probe
 */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { auth } from "./auth.ts";
import { apiEnv } from "./env.ts";
import { errorResponse, handleError } from "./errors.ts";
import { meRoutes, companyRoutes, publicRoutes } from "./routes/account.ts";
import { alertProfileRoutes, cpvRoutes } from "./routes/alerts.ts";
import { dashboardRoutes, matchRoutes, notificationRoutes } from "./routes/dashboard.ts";
import {
  authorityRoutes,
  importRoutes,
  taskRoutes,
  tenderRoutes,
  trackedRoutes,
} from "./routes/tenders.ts";

/** Application API mounted at /api/v1. Its type drives `@licita/api-client`. */
export const v1Routes = new Hono()
  .route("/public", publicRoutes)
  .route("/me", meRoutes)
  .route("/companies", companyRoutes)
  .route("/alert-profiles", alertProfileRoutes)
  .route("/cpv", cpvRoutes)
  .route("/tenders", tenderRoutes)
  .route("/authorities", authorityRoutes)
  .route("/imports", importRoutes)
  .route("/tracked", trackedRoutes)
  .route("/tasks", taskRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/matches", matchRoutes)
  .route("/notifications", notificationRoutes);

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
  app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024 }));

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.route("/api/v1", v1Routes);
  return app;
}
