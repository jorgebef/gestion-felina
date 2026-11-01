/** Actions, the town hall feed/validation and the dashboard. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createAction,
  deleteAction,
  getAction,
  listActions,
  listCatOptions,
  setActionStatus,
  setActionValidation,
  updateAction,
} from "@felina/core/actions";
import { getDashboard } from "@felina/core/dashboard";
import {
  actionInputSchema,
  actionListSchema,
  actionStatusSchema,
  validationSchema,
} from "@felina/schemas/action";
import { idParamSchema } from "@felina/schemas/common";

import { onInvalid, requireOrg } from "../middleware.ts";

const id = zValidator("param", idParamSchema, onInvalid);

export const actionRoutes = new Hono()
  .use(requireOrg)
  .get("/", zValidator("query", actionListSchema, onInvalid), async (c) =>
    c.json(await listActions(c.var.ctx, c.req.valid("query"))),
  )
  /** The caller's association cats, for the action form. */
  .get("/cat-options", async (c) => c.json(await listCatOptions(c.var.ctx)))
  .post("/", zValidator("json", actionInputSchema, onInvalid), async (c) =>
    c.json(await createAction(c.var.ctx, c.req.valid("json")), 201),
  )
  .get("/:id", id, async (c) => c.json(await getAction(c.var.ctx, c.req.valid("param").id)))
  .put("/:id", id, zValidator("json", actionInputSchema, onInvalid), async (c) =>
    c.json(await updateAction(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .patch("/:id/status", id, zValidator("json", actionStatusSchema, onInvalid), async (c) =>
    c.json(await setActionStatus(c.var.ctx, c.req.valid("param").id, c.req.valid("json").status)),
  )
  .delete("/:id", id, async (c) => c.json(await deleteAction(c.var.ctx, c.req.valid("param").id)))
  /** Town hall of the action's municipality. */
  .put("/:id/validation", id, zValidator("json", validationSchema, onInvalid), async (c) =>
    c.json(
      await setActionValidation(c.var.ctx, c.req.valid("param").id, c.req.valid("json").validated),
    ),
  );

export const dashboardRoutes = new Hono()
  .use(requireOrg)
  .get("/", async (c) => c.json(await getDashboard(c.var.ctx)));
