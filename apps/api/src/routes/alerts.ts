/** Alert profiles and CPV helpers. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createAlertProfile,
  deleteAlertProfile,
  getAlertProfile,
  listAlertProfiles,
  searchCpvCodes,
  setAlertProfileActive,
  suggestCpvCodes,
  updateAlertProfile,
} from "@licita/core/alerts";
import { alertProfileActiveSchema, alertProfileInputSchema } from "@licita/schemas/alert-profile";
import { idParamSchema, searchTermSchema } from "@licita/schemas/common";
import { cpvSuggestSchema } from "@licita/schemas/cpv";

import { onInvalid, requireCompany } from "../middleware.ts";

const id = zValidator("param", idParamSchema, onInvalid);

export const alertProfileRoutes = new Hono()
  .use(requireCompany)
  .get("/", async (c) => c.json(await listAlertProfiles(c.var.ctx)))
  .post("/", zValidator("json", alertProfileInputSchema, onInvalid), async (c) =>
    c.json(await createAlertProfile(c.var.ctx, c.req.valid("json")), 201),
  )
  .get("/:id", id, async (c) => c.json(await getAlertProfile(c.var.ctx, c.req.valid("param").id)))
  .put("/:id", id, zValidator("json", alertProfileInputSchema, onInvalid), async (c) =>
    c.json(await updateAlertProfile(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .patch("/:id/active", id, zValidator("json", alertProfileActiveSchema, onInvalid), async (c) =>
    c.json(
      await setAlertProfileActive(c.var.ctx, c.req.valid("param").id, c.req.valid("json").isActive),
    ),
  )
  .delete("/:id", id, async (c) =>
    c.json(await deleteAlertProfile(c.var.ctx, c.req.valid("param").id)),
  );

export const cpvRoutes = new Hono()
  .use(requireCompany)
  .get("/", zValidator("query", searchTermSchema, onInvalid), async (c) =>
    c.json(await searchCpvCodes(c.var.ctx, c.req.valid("query").q)),
  )
  /** Editable proposals from the description and sectors; never applied automatically. */
  .post("/suggestions", zValidator("json", cpvSuggestSchema, onInvalid), async (c) =>
    c.json(await suggestCpvCodes(c.var.ctx, c.req.valid("json"))),
  );
