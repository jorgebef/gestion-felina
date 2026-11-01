/** Dashboard, matches and email notifications of the signed-in user. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { getDashboard, listMatches, listMyDeliveries, sendTestEmail } from "@licita/core/dashboard";
import { setMatchFeedback } from "@licita/core/tracking";
import { idParamSchema } from "@licita/schemas/common";
import { matchFeedbackSchema, matchListSchema } from "@licita/schemas/matches";

import { onInvalid, requireCompany } from "../middleware.ts";

export const dashboardRoutes = new Hono()
  .use(requireCompany)
  .get("/", async (c) => c.json(await getDashboard(c.var.ctx)));

export const matchRoutes = new Hono()
  .use(requireCompany)
  .get("/", zValidator("query", matchListSchema, onInvalid), async (c) =>
    c.json(await listMatches(c.var.ctx, c.req.valid("query"))),
  )
  .patch(
    "/:id/feedback",
    zValidator("param", idParamSchema, onInvalid),
    zValidator("json", matchFeedbackSchema, onInvalid),
    async (c) =>
      c.json(
        await setMatchFeedback(c.var.ctx, c.req.valid("param").id, c.req.valid("json").feedback),
      ),
  );

export const notificationRoutes = new Hono()
  .use(requireCompany)
  .get("/", async (c) => c.json(await listMyDeliveries(c.var.ctx)))
  .post("/test", async (c) => c.json(await sendTestEmail(c.var.ctx)));
