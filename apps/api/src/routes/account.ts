/** Session, profile, the caller's organization, members and invitations. */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  getOrganizationAvatar,
  getUserAvatar,
  removeMyAvatar,
  setMyAvatar,
  setOrganizationAvatar,
} from "@felina/core/avatars";
import { readViewer } from "@felina/core/context";
import { getMunicipality, searchMunicipalities } from "@felina/core/municipalities";
import {
  acceptInvitation,
  getInvitationPreview,
  getMyOrganization,
  getMyProfile,
  inviteMember,
  listInvitations,
  listMembers,
  registerAssociation,
  removeMember,
  revokeInvitation,
  setMemberRole,
  updateMyOrganization,
  updateMyProfile,
} from "@felina/core/organizations";
import { idParamSchema, searchTermSchema, tokenParamSchema } from "@felina/schemas/common";
import {
  associationRegistrationSchema,
  invitationInputSchema,
  memberRoleSchema,
  organizationUpdateSchema,
  userProfileSchema,
} from "@felina/schemas/organization";
import { z } from "zod";

import { isGoogleAuthEnabled } from "../auth.ts";
import { imageResponse, uploadedImage } from "../images.ts";
import { onInvalid, requireOrg, requireUser, sessionUser } from "../middleware.ts";

const id = zValidator("param", idParamSchema, onInvalid);
const token = zValidator("param", tokenParamSchema, onInvalid);

export const publicRoutes = new Hono()
  .get("/auth-config", (c) => c.json({ googleEnabled: isGoogleAuthEnabled }))
  /** What an invitation link is about, before signing in. */
  .get("/invitations/:token", token, async (c) =>
    c.json(await getInvitationPreview(c.req.valid("param").token)),
  )
  /** An organization's photo (public, like its name on an invitation). */
  .get("/organizations/:id/avatar", id, async (c) =>
    imageResponse(c, await getOrganizationAvatar(c.req.valid("param").id), "public"),
  );

export const meRoutes = new Hono()
  /** Signed-in user and their organization; `null` for anonymous visitors (not an error). */
  .get("/", async (c) => {
    const user = await sessionUser(c.req.raw.headers);
    if (!user) return c.json(null);
    const { avatar, ...viewer } = await readViewer(user.id);
    return c.json({ user: { ...user, avatar }, ...viewer });
  })
  /** The caller's own account (profile page). */
  .get("/profile", requireUser, async (c) => c.json(await getMyProfile(c.var.ctx)))
  .patch("/", requireUser, zValidator("json", userProfileSchema, onInvalid), async (c) =>
    c.json(await updateMyProfile(c.var.ctx, c.req.valid("json"))),
  )
  /** Own profile photo: multipart/form-data with a `file` field. */
  .post("/avatar", requireUser, async (c) =>
    c.json(await setMyAvatar(c.var.ctx, await uploadedImage(c)), 201),
  )
  .delete("/avatar", requireUser, async (c) => c.json(await removeMyAvatar(c.var.ctx)));

/** People's profile photos, for whoever can see them. */
export const userRoutes = new Hono().get("/:id/avatar", requireUser, id, async (c) =>
  imageResponse(c, await getUserAvatar(c.var.ctx, c.req.valid("param").id)),
);

export const invitationRoutes = new Hono()
  .post("/:token/accept", requireUser, token, async (c) =>
    c.json(await acceptInvitation(c.var.ctx, c.req.valid("param").token)),
  )
  .delete("/:id", requireUser, id, async (c) =>
    c.json(await revokeInvitation(c.var.ctx, c.req.valid("param").id)),
  );

export const municipalityRoutes = new Hono()
  .use(requireUser)
  .get("/", zValidator("query", searchTermSchema, onInvalid), async (c) =>
    c.json(await searchMunicipalities(c.req.valid("query").q)),
  )
  .get(
    "/:code",
    zValidator("param", z.object({ code: z.string().regex(/^\d{5}$/) }), onInvalid),
    async (c) => c.json(await getMunicipality(c.req.valid("param").code)),
  );

export const organizationRoutes = new Hono()
  /** Association sign-up: pending until the super admin approves it. */
  .post("/", requireUser, zValidator("json", associationRegistrationSchema, onInvalid), async (c) =>
    c.json(await registerAssociation(c.var.ctx, c.req.valid("json")), 201),
  )
  .get("/current", requireOrg, async (c) => c.json(await getMyOrganization(c.var.ctx)))
  .patch(
    "/current",
    requireOrg,
    zValidator("json", organizationUpdateSchema, onInvalid),
    async (c) => c.json(await updateMyOrganization(c.var.ctx, c.req.valid("json"))),
  )
  /** The organization's photo (admins): multipart/form-data with a `file` field. */
  .post("/current/avatar", requireOrg, async (c) =>
    c.json(await setOrganizationAvatar(c.var.ctx, await uploadedImage(c)), 201),
  )
  .delete("/current/avatar", requireOrg, async (c) =>
    c.json(await setOrganizationAvatar(c.var.ctx, null)),
  )
  .get("/current/members", requireOrg, async (c) => c.json(await listMembers(c.var.ctx)))
  .patch(
    "/current/members/:id",
    requireOrg,
    id,
    zValidator("json", memberRoleSchema, onInvalid),
    async (c) =>
      c.json(await setMemberRole(c.var.ctx, c.req.valid("param").id, c.req.valid("json").role)),
  )
  .delete("/current/members/:id", requireOrg, id, async (c) =>
    c.json(await removeMember(c.var.ctx, c.req.valid("param").id)),
  )
  .get("/current/invitations", requireOrg, async (c) => c.json(await listInvitations(c.var.ctx)))
  .post(
    "/current/invitations",
    requireOrg,
    zValidator("json", invitationInputSchema, onInvalid),
    async (c) => c.json(await inviteMember(c.var.ctx, c.req.valid("json")), 201),
  );
