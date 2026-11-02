/** Colonies, cats, photo uploads and change proposals. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createCat,
  deleteCat,
  getCat,
  getCatPhoto,
  listCats,
  listColonyOptions,
  updateCat,
  uploadCatPhoto,
} from "@felina/core/cats";
import {
  addColonyManager,
  createColony,
  deleteColony,
  getColony,
  listColonies,
  removeColonyManager,
  setColonyAuthorization,
  updateColony,
} from "@felina/core/colonies";
import {
  listDeletionRequests,
  requestDeletion,
  resolveDeletion,
  withdrawDeletion,
} from "@felina/core/deletions";
import { DomainError } from "@felina/core/context";
import {
  listProposals,
  proposeCatChange,
  proposeColonyChange,
  resolveProposal,
  withdrawProposal,
} from "@felina/core/proposals";
import { catInputSchema, catListSchema, MAX_PHOTO_BYTES } from "@felina/schemas/cat";
import { authorizationSchema, colonyInputSchema, colonyListSchema } from "@felina/schemas/colony";
import { idParamSchema } from "@felina/schemas/common";
import {
  colonyManagerInputSchema,
  deletionListSchema,
  deletionRequestInputSchema,
  deletionResolutionSchema,
} from "@felina/schemas/deletion";
import {
  catProposalSchema,
  colonyProposalSchema,
  proposalListSchema,
  proposalResolutionSchema,
} from "@felina/schemas/proposal";
import { z } from "zod";

import { onInvalid, requireOrg } from "../middleware.ts";

const id = zValidator("param", idParamSchema, onInvalid);

export const colonyRoutes = new Hono()
  .use(requireOrg)
  .get("/", zValidator("query", colonyListSchema, onInvalid), async (c) =>
    c.json(await listColonies(c.var.ctx, c.req.valid("query"))),
  )
  /** The caller's association colonies, for pickers. */
  .get("/options", async (c) => c.json(await listColonyOptions(c.var.ctx)))
  .post("/", zValidator("json", colonyInputSchema, onInvalid), async (c) =>
    c.json(await createColony(c.var.ctx, c.req.valid("json")), 201),
  )
  .get("/:id", id, async (c) => c.json(await getColony(c.var.ctx, c.req.valid("param").id)))
  .put("/:id", id, zValidator("json", colonyInputSchema, onInvalid), async (c) =>
    c.json(await updateColony(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .delete("/:id", id, async (c) => c.json(await deleteColony(c.var.ctx, c.req.valid("param").id)))
  /** Town hall of the colony's municipality. */
  .put("/:id/authorization", id, zValidator("json", authorizationSchema, onInvalid), async (c) =>
    c.json(
      await setColonyAuthorization(
        c.var.ctx,
        c.req.valid("param").id,
        c.req.valid("json").authorized,
      ),
    ),
  )
  .post("/:id/proposals", id, zValidator("json", colonyProposalSchema, onInvalid), async (c) =>
    c.json(await proposeColonyChange(c.var.ctx, c.req.valid("param").id, c.req.valid("json")), 201),
  )
  /** Association admins name and remove the colony's managers. */
  .post("/:id/managers", id, zValidator("json", colonyManagerInputSchema, onInvalid), async (c) =>
    c.json(
      await addColonyManager(c.var.ctx, c.req.valid("param").id, c.req.valid("json").userId),
      201,
    ),
  )
  .delete(
    "/:id/managers/:userId",
    zValidator("param", z.object({ id: z.uuid(), userId: z.uuid() }), onInvalid),
    async (c) => {
      const { id: colonyId, userId } = c.req.valid("param");
      return c.json(await removeColonyManager(c.var.ctx, colonyId, userId));
    },
  );

export const catRoutes = new Hono()
  .use(requireOrg)
  .get("/", zValidator("query", catListSchema, onInvalid), async (c) =>
    c.json(await listCats(c.var.ctx, c.req.valid("query"))),
  )
  .post("/", zValidator("json", catInputSchema, onInvalid), async (c) =>
    c.json(await createCat(c.var.ctx, c.req.valid("json")), 201),
  )
  .get("/:id", id, async (c) => c.json(await getCat(c.var.ctx, c.req.valid("param").id)))
  .put("/:id", id, zValidator("json", catInputSchema, onInvalid), async (c) =>
    c.json(await updateCat(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .delete("/:id", id, async (c) => c.json(await deleteCat(c.var.ctx, c.req.valid("param").id)))
  /** Main photo; only for people who can see the cat. */
  .get("/:id/photo", id, async (c) => {
    const photo = await getCatPhoto(c.var.ctx, c.req.valid("param").id);
    if (!photo) throw new DomainError("NOT_FOUND", "Foto no disponible");
    return c.body(photo.body as Uint8Array<ArrayBuffer>, 200, {
      "content-type": photo.contentType,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    });
  })
  .post("/:id/proposals", id, zValidator("json", catProposalSchema, onInvalid), async (c) =>
    c.json(await proposeCatChange(c.var.ctx, c.req.valid("param").id, c.req.valid("json")), 201),
  );

export const uploadRoutes = new Hono()
  .use(requireOrg)
  /** multipart/form-data with a `file` field; returns the `photoKey` for the cat form. */
  .post("/photos", async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) throw new DomainError("VALIDATION", "Adjunta una foto");
    if (file.size > MAX_PHOTO_BYTES) {
      throw new DomainError("VALIDATION", "La foto no puede superar los 8 MB");
    }
    return c.json(await uploadCatPhoto(c.var.ctx, new Uint8Array(await file.arrayBuffer())), 201);
  });

export const proposalRoutes = new Hono()
  .use(requireOrg)
  .get(
    "/",
    zValidator(
      "query",
      proposalListSchema.extend({
        colonyId: z.uuid().optional().catch(undefined),
        catId: z.uuid().optional().catch(undefined),
      }),
      onInvalid,
    ),
    async (c) => c.json(await listProposals(c.var.ctx, c.req.valid("query"))),
  )
  .post("/:id/resolve", id, zValidator("json", proposalResolutionSchema, onInvalid), async (c) =>
    c.json(await resolveProposal(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .post("/:id/withdraw", id, async (c) =>
    c.json(await withdrawProposal(c.var.ctx, c.req.valid("param").id)),
  );

/** Deletions of colonies, cats and actions asked for by non-admins. */
export const deletionRoutes = new Hono()
  .use(requireOrg)
  .get("/", zValidator("query", deletionListSchema, onInvalid), async (c) =>
    c.json(await listDeletionRequests(c.var.ctx, c.req.valid("query"))),
  )
  .post("/", zValidator("json", deletionRequestInputSchema, onInvalid), async (c) =>
    c.json(await requestDeletion(c.var.ctx, c.req.valid("json")), 201),
  )
  .post("/:id/resolve", id, zValidator("json", deletionResolutionSchema, onInvalid), async (c) =>
    c.json(await resolveDeletion(c.var.ctx, c.req.valid("param").id, c.req.valid("json"))),
  )
  .post("/:id/withdraw", id, async (c) =>
    c.json(await withdrawDeletion(c.var.ctx, c.req.valid("param").id)),
  );
