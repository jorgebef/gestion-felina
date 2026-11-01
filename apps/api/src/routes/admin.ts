/** Super-admin endpoints. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createTownHall,
  getOrganizationDetail,
  inviteToOrganization,
  listOrganizations,
  reviewOrganization,
} from "@felina/core/admin";
import { idParamSchema } from "@felina/schemas/common";
import {
  invitationInputSchema,
  organizationListSchema,
  organizationReviewSchema,
  townHallCreateSchema,
} from "@felina/schemas/organization";

import { onInvalid, requirePlatformAdmin } from "../middleware.ts";

const id = zValidator("param", idParamSchema, onInvalid);

export const adminRoutes = new Hono()
  .use(requirePlatformAdmin)
  .get("/organizations", zValidator("query", organizationListSchema, onInvalid), async (c) =>
    c.json(await listOrganizations(c.var.ctx, c.req.valid("query"))),
  )
  .get("/organizations/:id", id, async (c) =>
    c.json(await getOrganizationDetail(c.var.ctx, c.req.valid("param").id)),
  )
  .post(
    "/organizations/:id/review",
    id,
    zValidator("json", organizationReviewSchema, onInvalid),
    async (c) =>
      c.json(await reviewOrganization(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .post(
    "/organizations/:id/invitations",
    id,
    zValidator("json", invitationInputSchema, onInvalid),
    async (c) =>
      c.json(
        await inviteToOrganization(c.var.ctx, c.req.valid("param").id, c.req.valid("json")),
        201,
      ),
  )
  .post("/town-halls", zValidator("json", townHallCreateSchema, onInvalid), async (c) =>
    c.json(await createTownHall(c.var.ctx, c.req.valid("json")), 201),
  );
