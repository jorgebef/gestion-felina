/** Tender search and detail, saved tenders ("Mis licitaciones") and tasks. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { findAuthorities, getLastImport, getTender, searchTenderList } from "@licita/core/tenders";
import {
  createTask,
  deleteTask,
  getTrackedDetail,
  listTracked,
  setTaskCompleted,
  trackTender,
  untrackTender,
  updateTracked,
} from "@licita/core/tracking";
import { idParamSchema, searchTermSchema } from "@licita/schemas/common";
import { tenderSearchSchema } from "@licita/schemas/tender-search";
import {
  taskCompletionSchema,
  taskInputSchema,
  trackedListSchema,
  trackedUpdateSchema,
} from "@licita/schemas/tracking";

import { onInvalid, requireCompany } from "../middleware.ts";

const id = zValidator("param", idParamSchema, onInvalid);

export const tenderRoutes = new Hono()
  .use(requireCompany)
  .get("/", zValidator("query", tenderSearchSchema, onInvalid), async (c) =>
    c.json(await searchTenderList(c.var.ctx, c.req.valid("query"))),
  )
  .get("/:id", id, async (c) => c.json(await getTender(c.var.ctx, c.req.valid("param").id)))
  /** The company's tracking record for this tender, or `null` when not saved. */
  .get("/:id/tracking", id, async (c) =>
    c.json(await getTrackedDetail(c.var.ctx, c.req.valid("param").id)),
  )
  .put("/:id/tracking", id, async (c) =>
    c.json(await trackTender(c.var.ctx, c.req.valid("param").id)),
  )
  .delete("/:id/tracking", id, async (c) =>
    c.json(await untrackTender(c.var.ctx, c.req.valid("param").id)),
  );

export const authorityRoutes = new Hono()
  .use(requireCompany)
  .get("/", zValidator("query", searchTermSchema, onInvalid), async (c) =>
    c.json(await findAuthorities(c.var.ctx, c.req.valid("query").q)),
  );

export const importRoutes = new Hono()
  .use(requireCompany)
  .get("/latest", async (c) => c.json(await getLastImport(c.var.ctx)));

export const trackedRoutes = new Hono()
  .use(requireCompany)
  .get("/", zValidator("query", trackedListSchema, onInvalid), async (c) =>
    c.json(await listTracked(c.var.ctx, c.req.valid("query").status)),
  )
  .patch("/:id", id, zValidator("json", trackedUpdateSchema, onInvalid), async (c) =>
    c.json(await updateTracked(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .post("/:id/tasks", id, zValidator("json", taskInputSchema, onInvalid), async (c) =>
    c.json(await createTask(c.var.ctx, c.req.valid("param").id, c.req.valid("json")), 201),
  );

export const taskRoutes = new Hono()
  .use(requireCompany)
  .patch("/:id", id, zValidator("json", taskCompletionSchema, onInvalid), async (c) =>
    c.json(
      await setTaskCompleted(c.var.ctx, c.req.valid("param").id, c.req.valid("json").completed),
    ),
  )
  .delete("/:id", id, async (c) => c.json(await deleteTask(c.var.ctx, c.req.valid("param").id)));
