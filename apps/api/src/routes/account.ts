/** Session, profile and company endpoints. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createCompany,
  getCompanySettings,
  updateCompany,
  updateMyProfile,
} from "@licita/core/companies";
import { readActiveCompany } from "@licita/core/context";
import { getPublicStats } from "@licita/core/tenders";
import { companyInputSchema, userProfileSchema } from "@licita/schemas/company";

import { isGoogleAuthEnabled } from "../auth.ts";
import { onInvalid, requireCompany, requireUser, sessionUser } from "../middleware.ts";

export const publicRoutes = new Hono()
  .get("/auth-config", (c) => c.json({ googleEnabled: isGoogleAuthEnabled }))
  .get("/stats", async (c) => c.json(await getPublicStats()));

export const meRoutes = new Hono()
  /** Signed-in user and active company; `null` for anonymous visitors (not an error). */
  .get("/", async (c) => {
    const user = await sessionUser(c.req.raw.headers);
    if (!user) return c.json(null);
    return c.json({ user, company: await readActiveCompany(user.id) });
  })
  .patch("/", requireUser, zValidator("json", userProfileSchema, onInvalid), async (c) =>
    c.json(await updateMyProfile(c.var.ctx, c.req.valid("json"))),
  );

export const companyRoutes = new Hono()
  /** Onboarding: the caller becomes the owner of the new company. */
  .post("/", requireUser, zValidator("json", companyInputSchema, onInvalid), async (c) =>
    c.json(await createCompany(c.var.ctx, c.req.valid("json")), 201),
  )
  .get("/current", requireCompany, async (c) => c.json(await getCompanySettings(c.var.ctx)))
  .patch("/current", requireCompany, zValidator("json", companyInputSchema, onInvalid), async (c) =>
    c.json(await updateCompany(c.var.ctx, c.req.valid("json"))),
  );
