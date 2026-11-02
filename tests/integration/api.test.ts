/**
 * The API end to end, in process: Better Auth sessions, the typed client, validation,
 * error format and the full association ↔ town hall workflow.
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";

import { createApp } from "@felina/api";
import { ApiError, createApi } from "@felina/api-client";
import { getDb, users } from "@felina/db";
import { setMailer } from "@felina/notifications/mailer";
import { runActionReminders } from "@felina/notifications/reminders";
import { createLocalStorage, setStorage } from "@felina/storage";

import {
  addMember,
  describeDb,
  GETAFE,
  MADRID,
  MADRID_POINT,
  PNG,
  recordingMailer,
  registerAssociationFor,
  resetData,
} from "./helpers.ts";

const ORIGIN = "http://localhost:3000";
const app = createApp();

function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", ORIGIN);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body && typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return app.request(`${ORIGIN}${path}`, { ...init, headers });
}

let clientIp = 0;

async function signUp(email: string): Promise<string> {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    // Better Auth rate-limits sign-ups per client address (forwarded by the web proxy).
    headers: { "x-forwarded-for": `198.51.100.${++clientIp}` },
    body: JSON.stringify({ email, password: "correct horse battery", name: email.split("@")[0] }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.includes("session_token"));
  expect(cookie).toBeTruthy();
  return cookie!;
}

/** Typed client wired straight to the in-process app (no network). */
function clientFor(cookie: string) {
  return createApi({
    baseUrl: ORIGIN,
    headers: () => ({ cookie, origin: ORIGIN }),
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      app.request(input instanceof Request ? input : String(input), init)) as typeof fetch,
  });
}

async function expectApiError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
  return error as ApiError;
}

function tokenFrom(text: string): string {
  const match = /\/invitacion\/([\w-]+)/.exec(text);
  expect(match).toBeTruthy();
  return match![1]!;
}

it("answers the health check", async () => {
  const response = await app.request("/health");
  expect(await response.json()).toEqual({ ok: true });
});

it("returns JSON errors for unknown routes", async () => {
  const response = await request("/api/v1/nope");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "NOT_FOUND", message: "Ruta no encontrada" },
  });
});

describeDb("API", () => {
  let mail: ReturnType<typeof recordingMailer>;

  beforeEach(async () => {
    await resetData();
    mail = recordingMailer();
    setMailer(mail.mailer);
    setStorage(createLocalStorage(`${process.cwd()}/.data/test-uploads`));
  });
  afterEach(() => {
    setMailer(undefined);
    setStorage(undefined);
  });

  it("treats anonymous visitors as such", async () => {
    expect(await (await request("/api/v1/me")).json()).toBeNull();
    expect((await request("/api/v1/colonies")).status).toBe(401);
  });

  it("checks the origin of browser requests only", async () => {
    const accept = (headers: Record<string, string>) =>
      app.request(`${ORIGIN}/api/v1/invitations/${"t".repeat(43)}/accept`, {
        method: "POST",
        headers,
      });
    // A bodyless POST from another site is rejected before reaching the route…
    const forged = await accept({ origin: "https://evil.example", "sec-fetch-site": "cross-site" });
    expect(forged.status).toBe(403);
    expect(await forged.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    // …while the web app (same origin) and the mobile app (no Origin) get through.
    expect((await accept({ origin: ORIGIN })).status).toBe(401);
    expect((await accept({ "sec-fetch-site": "same-origin" })).status).toBe(401);
    expect((await accept({})).status).toBe(401);
  });

  it("lets colony managers edit their colonies and admins approve every deletion", async () => {
    // An approved association: Ana (admin), Gema (will manage one colony), Vito (member).
    const ana = clientFor(await signUp("ana@example.test"));
    const gema = clientFor(await signUp("gema@example.test"));
    const vito = clientFor(await signUp("vito@example.test"));
    const [anaId, gemaId, vitoId] = await Promise.all(
      [ana, gema, vito].map(async (c) => (await c.me.get())!.user.id),
    );
    const orgId = await registerAssociationFor(anaId!, "Gatos del Sur");
    await addMember(gemaId!, orgId);
    await addMember(vitoId!, orgId);

    const place = { ...MADRID_POINT, municipalityCode: MADRID };
    const { id: northId } = await ana.colonies.create({ name: "Norte", ...place });
    const { id: southId } = await ana.colonies.create({ name: "Sur", ...place });
    const newCat = async (client: typeof ana, name: string, colonyId: string | null) => {
      const { photoKey } = await client.cats.uploadPhoto(new Blob([PNG], { type: "image/png" }));
      return client.cats.create({
        name,
        sex: "female",
        birthDate: null,
        photoKey,
        colonyId,
        ...place,
      });
    };

    // Only admins create colonies and name managers.
    await expectApiError(vito.colonies.create({ name: "Otra", ...place }), "FORBIDDEN");
    await expectApiError(vito.colonies.addManager(northId, vitoId!), "FORBIDDEN");
    await ana.colonies.addManager(northId, gemaId!);
    await ana.colonies.addManager(northId, gemaId!); // twice is fine
    expect((await vito.colonies.get(northId)).managers.map((m) => m.email)).toEqual([
      "gema@example.test",
    ]);

    // Members see colonies but don't change them or their cats.
    const asVito = await vito.colonies.get(northId);
    expect(asVito.permissions).toMatchObject({
      canEdit: false,
      canAddCats: false,
      canDelete: false,
      canRequestDeletion: false,
    });
    await expectApiError(vito.colonies.update(northId, { name: "Mío", ...place }), "FORBIDDEN");
    await expectApiError(newCat(vito, "Intrusa", northId), "FORBIDDEN");
    // Cats without a colony are anyone's, but can't be moved into a colony they don't manage.
    const { id: looseId } = await newCat(vito, "Suelta", null);
    expect((await vito.cats.get(looseId)).permissions.canEdit).toBe(true);
    const loose = await vito.cats.get(looseId);
    const looseInput = {
      name: "Suelta",
      sex: loose.cat.sex,
      birthDate: null,
      photoKey: loose.photoKey!,
      ...place,
    };
    await vito.cats.update(looseId, { ...looseInput, colonyId: null, name: "Suelta 2" });
    await expectApiError(
      vito.cats.update(looseId, { ...looseInput, colonyId: northId }),
      "FORBIDDEN",
    );

    // Managers change their colony and its cats, not other colonies.
    expect((await gema.colonies.get(northId)).permissions).toMatchObject({
      canEdit: true,
      canAddCats: true,
      canDelete: false,
      canRequestDeletion: true,
    });
    expect((await gema.colonies.get(southId)).permissions.canEdit).toBe(false);
    await gema.colonies.update(northId, { name: "Norte (río)", ...place });
    await expectApiError(gema.colonies.update(southId, { name: "Sur", ...place }), "FORBIDDEN");
    const { id: catId } = await newCat(gema, "Luna", northId);
    const { id: otherCatId } = await newCat(gema, "Sol", northId);
    expect((await vito.cats.get(catId)).permissions.canEdit).toBe(false);
    expect((await gema.colonies.options()).map((o) => [o.name, o.canManage])).toEqual([
      ["Norte (río)", true],
      ["Sur", false],
    ]);

    // Any member still runs actions: a sterilization Vito completes marks the cat.
    const { id: actionId } = await vito.actions.create({
      actionType: "sterilization",
      name: "Castración de Sol",
      scheduledAt: new Date().toISOString(),
      colonyId: northId,
      catIds: [otherCatId],
    });
    expect((await vito.actions.setStatus(actionId, "done")).sterilizedCats).toBe(1);
    expect((await ana.cats.get(otherCatId)).cat.sterilized).toBe(true);

    // Only admins delete; the rest ask.
    await expectApiError(gema.cats.delete(catId), "FORBIDDEN");
    await expectApiError(gema.colonies.delete(northId), "FORBIDDEN");
    await expectApiError(vito.actions.delete(actionId), "FORBIDDEN");
    await expectApiError(
      vito.deletions.request({ targetType: "cat", targetId: catId }),
      "FORBIDDEN",
    );
    await expectApiError(ana.deletions.request({ targetType: "cat", targetId: catId }), "CONFLICT");
    mail.sent.length = 0;
    const { id: firstRequest } = await gema.deletions.request({
      targetType: "cat",
      targetId: catId,
      reason: "Está duplicada",
    });
    expect(mail.sent.map((m) => m.to)).toEqual(["ana@example.test"]);
    expect(mail.sent[0]!.text).toContain("Está duplicada");
    await expectApiError(
      gema.deletions.request({ targetType: "cat", targetId: catId }),
      "CONFLICT",
    );
    expect((await gema.cats.get(catId)).pendingDeletion).toMatchObject({
      reason: "Está duplicada",
      requestedByMe: true,
    });
    expect((await ana.cats.get(catId)).permissions).toMatchObject({
      canDelete: true,
      canResolveDeletion: true,
    });

    // Members can't resolve; a rejected request leaves the cat alone.
    await expectApiError(
      gema.deletions.resolve(firstRequest, { decision: "approve" }),
      "FORBIDDEN",
    );
    await ana.deletions.resolve(firstRequest, { decision: "reject", note: "Es otra gata" });
    expect(mail.sent.at(-1)).toMatchObject({ to: "gema@example.test" });
    expect((await gema.cats.get(catId)).pendingDeletion).toBeNull();

    // Approving deletes it.
    const { id: secondRequest } = await gema.deletions.request({
      targetType: "cat",
      targetId: catId,
    });
    await ana.deletions.resolve(secondRequest, { decision: "approve" });
    await expectApiError(ana.cats.get(catId), "NOT_FOUND");
    const history = await vito.deletions.list();
    expect(history.map((r) => [r.targetLabel, r.status, r.resolvedByName])).toEqual([
      ["Luna", "approved", "ana"],
      ["Luna", "rejected", "ana"],
    ]);

    // Requesters can withdraw; admins can also delete directly, closing pending requests.
    const { id: actionRequest } = await vito.deletions.request({
      targetType: "action",
      targetId: actionId,
    });
    await expectApiError(gema.deletions.withdraw(actionRequest), "NOT_FOUND");
    await vito.deletions.withdraw(actionRequest);
    await vito.deletions.request({ targetType: "action", targetId: actionId });
    await ana.actions.delete(actionId);
    expect((await ana.deletions.list({ status: "approved" })).map((r) => r.targetType)).toEqual([
      "action",
      "cat",
    ]);

    // A deleted colony keeps its cats (without colony).
    const { id: colonyRequest } = await gema.deletions.request({
      targetType: "colony",
      targetId: northId,
    });
    await ana.deletions.resolve(colonyRequest, { decision: "approve", note: "De acuerdo" });
    await expectApiError(ana.colonies.get(northId), "NOT_FOUND");
    expect((await ana.cats.get(otherCatId)).cat.colonyId).toBeNull();

    // Leaving the association ends the person's colony management.
    await ana.colonies.addManager(southId, gemaId!);
    await ana.organizations.removeMember(gemaId!);
    expect((await ana.colonies.get(southId)).managers).toEqual([]);
  });

  it("stores profile photos of people and organizations", async () => {
    const anaCookie = await signUp("ana@example.test");
    const ana = clientFor(anaCookie);
    const lola = clientFor(await signUp("lola@example.test"));
    const stranger = await signUp("extra@example.test");
    const [anaId, lolaId] = await Promise.all(
      [ana, lola].map(async (c) => (await c.me.get())!.user.id),
    );
    const orgId = await registerAssociationFor(anaId!, "Gatos con foto");
    await addMember(lolaId!, orgId);
    const png = () => new Blob([PNG], { type: "image/png" });

    // A person's photo: only images, seen by their organization, not by strangers.
    await expectApiError(ana.me.uploadAvatar(new Blob(["hola"])), "VALIDATION");
    const { avatar } = await ana.me.uploadAvatar(png());
    expect(avatar).toMatch(new RegExp(`^avatars/users/${anaId}/`));
    expect((await ana.me.get())?.user.avatar).toBe(avatar);
    expect((await lola.organizations.members()).find((m) => m.userId === anaId)?.avatar).toBe(
      avatar,
    );
    const photoOf = (userId: string, cookie: string) =>
      request(`/api/v1/users/${userId}/avatar`, { cookie });
    expect((await photoOf(anaId!, anaCookie)).status).toBe(200);
    expect((await photoOf(anaId!, stranger)).status).toBe(404);
    await ana.me.removeAvatar();
    expect((await ana.me.get())?.user.avatar).toBeNull();
    expect((await photoOf(anaId!, anaCookie)).status).toBe(404);

    // The organization's photo: its admins change it; anyone can see it.
    await expectApiError(lola.organizations.uploadAvatar(png()), "FORBIDDEN");
    const { avatar: logo } = await ana.organizations.uploadAvatar(png());
    expect((await lola.me.get())?.membership?.organization.avatar).toBe(logo);
    const publicLogo = await request(`/api/v1/public/organizations/${orgId}/avatar`);
    expect(publicLogo.status).toBe(200);
    expect(publicLogo.headers.get("content-type")).toBe("image/png");
    await ana.organizations.removeAvatar();
    expect((await request(`/api/v1/public/organizations/${orgId}/avatar`)).status).toBe(404);
  });

  it("lets every signed-in user read and edit their own profile", async () => {
    expect((await request("/api/v1/me/profile")).status).toBe(401);

    const pepa = clientFor(await signUp("pepa@example.test"));
    const before = await pepa.me.profile();
    expect(before).toMatchObject({ fullName: "pepa", email: "pepa@example.test", joinedAt: null });
    expect(Date.parse(before.createdAt)).not.toBeNaN();

    await expectApiError(pepa.me.update({ fullName: "   " }), "VALIDATION");
    await pepa.me.update({ fullName: "Pepa Gómez" });
    expect((await pepa.me.profile()).fullName).toBe("Pepa Gómez");
    expect((await pepa.me.get())?.user.name).toBe("Pepa Gómez");

    // Works with a pending organization too (the profile page is outside the org guard).
    await pepa.organizations.register({ name: "Gatos de Getafe", municipalityCode: GETAFE });
    expect((await pepa.me.profile()).joinedAt).not.toBeNull();
  });

  it("runs the association and town hall workflow", async () => {
    // --- The super admin exists (granted from the CLI) --------------------------
    const rootCookie = await signUp("root@example.test");
    await getDb()
      .update(users)
      .set({ isPlatformAdmin: true })
      .where(eq(users.email, "root@example.test"));
    const root = clientFor(rootCookie);

    // --- An association signs up and waits for approval -------------------------
    const ana = clientFor(await signUp("ana@example.test"));
    await expectApiError(ana.colonies.list(), "NO_ORGANIZATION");
    await expectApiError(ana.organizations.register({ name: "x" } as never), "VALIDATION");
    const { id: associationId } = await ana.organizations.register({
      name: "Gatos del Oeste",
      municipalityCode: MADRID,
      contactEmail: "hola@gatosdeloeste.test",
    });
    expect(mail.sent.at(-1)).toMatchObject({ to: "root@example.test" });
    expect((await ana.me.get())?.membership?.organization.status).toBe("pending");
    await expectApiError(ana.colonies.list(), "ORGANIZATION_NOT_APPROVED");
    await expectApiError(ana.organizations.register({ name: "Otra más" }), "CONFLICT");

    // Only the super admin reviews.
    await expectApiError(ana.admin.review(associationId, { status: "approved" }), "FORBIDDEN");
    const pending = await root.admin.organizations({ status: "pending" });
    expect(pending.items.map((o) => o.name)).toEqual(["Gatos del Oeste"]);
    await root.admin.review(associationId, { status: "approved", note: "Bienvenidas" });
    expect(mail.sent.at(-1)).toMatchObject({ to: "ana@example.test" });
    expect(mail.sent.at(-1)!.subject).toContain("aprobada");

    // --- Colony, photo, cat, action ----------------------------------------------
    await expectApiError(
      ana.colonies.create({
        name: "Fuera",
        latitude: 48.85,
        longitude: 2.35,
        municipalityCode: MADRID,
      }),
      "VALIDATION",
    );
    const { id: colonyId } = await ana.colonies.create({
      name: "Parque del Oeste",
      description: "Junto a la rosaleda",
      ...MADRID_POINT,
      municipalityCode: MADRID,
      address: "Paseo de Ruperto Chapí",
    });

    await expectApiError(
      ana.cats.uploadPhoto(new Blob([new TextEncoder().encode("not an image")])),
      "VALIDATION",
    );
    const { photoKey } = await ana.cats.uploadPhoto(new Blob([PNG], { type: "image/png" }));
    expect(photoKey).toMatch(new RegExp(`^cats/${associationId}/`));
    const { id: catId } = await ana.cats.create({
      colonyId,
      name: "Misi",
      sex: "female",
      birthDate: null,
      photoKey,
      ...MADRID_POINT,
      municipalityCode: MADRID,
    });
    const photo = await request(`/api/v1/cats/${catId}/photo`, {
      cookie: (await signInCookie("ana@example.test")) ?? "",
    });
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(PNG);

    const me = await ana.me.get();
    const today = new Date();
    today.setHours(today.getHours() + 1);
    const { id: actionId } = await ana.actions.create({
      actionType: "sterilization",
      name: "Castración de Misi",
      scheduledAt: today.toISOString(),
      isUrgent: true,
      status: "planned",
      colonyId,
      catIds: [catId],
      participantIds: [me!.user.id],
    });
    const detail = await ana.actions.get(actionId);
    expect(detail.action.municipalityName).toBe("Madrid");
    expect(detail.cats.map((c) => c.name)).toEqual(["Misi"]);

    // --- The super admin registers Madrid's town hall and invites its admin -------
    const townHall = await root.admin.createTownHall({
      municipalityCode: MADRID,
      adminEmail: "Concejalia@Madrid.test",
    });
    expect(townHall.emailSent).toBe(true);
    await expectApiError(
      root.admin.createTownHall({ municipalityCode: MADRID, adminEmail: "otra@madrid.test" }),
      "CONFLICT",
    );
    const invitationEmail = mail.sent.at(-1)!;
    expect(invitationEmail.to).toBe("concejalia@madrid.test");
    const token = tokenFrom(invitationEmail.text);
    // The super admin can copy the same link again from the organization's page.
    expect((await root.admin.organization(townHall.id)).invitations).toEqual([
      expect.objectContaining({
        email: "concejalia@madrid.test",
        url: `http://localhost:3000/invitacion/${token}`,
      }),
    ]);
    expect((await clientFor("").public.invitation(token)).organizationName).toBe(
      "Ayuntamiento de Madrid",
    );

    // Someone else cannot use the link; the invited person can.
    const intruder = clientFor(await signUp("intruso@example.test"));
    await expectApiError(intruder.invitations.accept(token), "FORBIDDEN");
    const concejalia = clientFor(await signUp("concejalia@madrid.test"));
    await concejalia.invitations.accept(token);
    const viewer = await concejalia.me.get();
    expect(viewer?.membership).toMatchObject({
      role: "admin",
      organization: { kind: "town_hall", status: "approved", municipalityName: "Madrid" },
    });

    // --- The town hall sees everything in Madrid, read-only ------------------------
    const colonies = await concejalia.colonies.list();
    expect(colonies.map((c) => [c.name, c.organizationName])).toEqual([
      ["Parque del Oeste", "Gatos del Oeste"],
    ]);
    expect((await concejalia.cats.list()).map((c) => c.name)).toEqual(["Misi"]);
    const feed = await concejalia.actions.list({ view: "feed" });
    expect(feed.items.map((a) => [a.name, a.validatedAt])).toEqual([["Castración de Misi", null]]);
    await expectApiError(
      concejalia.colonies.update(colonyId, {
        name: "Cambio directo",
        ...MADRID_POINT,
        municipalityCode: MADRID,
      }),
      "FORBIDDEN",
    );
    await expectApiError(concejalia.colonies.delete(colonyId), "FORBIDDEN");

    await concejalia.colonies.setAuthorization(colonyId, true);
    await concejalia.actions.setValidation(actionId, true);
    expect((await ana.colonies.get(colonyId)).colony.authorizedAt).not.toBeNull();
    expect((await concejalia.dashboard.get()).actions.pendingValidation).toBe(0);

    // Editing after validation is flagged in the feed.
    expect((await ana.cats.get(catId)).cat.sterilized).toBe(false);
    expect(await ana.actions.setStatus(actionId, "done")).toEqual({ ok: true, sterilizedCats: 1 });
    const [edited] = (await concejalia.actions.list({ view: "feed" })).items;
    expect(edited).toMatchObject({ status: "done", modifiedAfterValidation: true });

    // --- Sterilized: set by a done sterilization, otherwise edited by hand ---------
    expect((await ana.cats.get(catId)).cat.sterilized).toBe(true);
    expect((await concejalia.cats.list())[0]?.sterilized).toBe(true);
    // Reopening the action doesn't unmark it; marking it done again changes nothing.
    await ana.actions.setStatus(actionId, "in_progress");
    expect((await ana.cats.get(catId)).cat.sterilized).toBe(true);
    expect(await ana.actions.setStatus(actionId, "done")).toEqual({ ok: true, sterilizedCats: 0 });
    const catInput = {
      colonyId,
      name: "Misi",
      sex: "female" as const,
      birthDate: null,
      photoKey,
      ...MADRID_POINT,
      municipalityCode: MADRID,
    };
    await ana.cats.update(catId, { ...catInput, sterilized: false });
    expect((await ana.cats.get(catId)).cat.sterilized).toBe(false);
    // A cat registered as already sterilized; a done action that isn't a sterilization
    // leaves the flag alone.
    const { id: tomId } = await ana.cats.create({ ...catInput, name: "Tom", sterilized: true });
    expect((await ana.cats.get(tomId)).cat.sterilized).toBe(true);
    await ana.actions.create({
      actionType: "vet_visit",
      name: "Revisión de Misi",
      scheduledAt: today.toISOString(),
      isUrgent: false,
      status: "done",
      colonyId,
      catIds: [catId],
      participantIds: [],
    });
    expect((await ana.cats.get(catId)).cat.sterilized).toBe(false);
    // Created directly as a done sterilization: the cat is marked.
    await ana.actions.create({
      actionType: "sterilization",
      name: "Castración de Misi (repaso)",
      scheduledAt: today.toISOString(),
      isUrgent: false,
      status: "done",
      colonyId,
      catIds: [catId],
      participantIds: [],
    });
    expect((await ana.cats.get(catId)).cat.sterilized).toBe(true);
    expect((await ana.dashboard.get()).cats).toMatchObject({ total: 2, sterilized: 2 });

    // --- Change proposals ----------------------------------------------------------
    await expectApiError(
      concejalia.colonies.propose(colonyId, { changes: { name: "Parque del Oeste" } }),
      "VALIDATION",
    );
    const { id: proposalId } = await concejalia.colonies.propose(colonyId, {
      changes: { name: "Parque del Oeste (rosaleda)", address: null },
      message: "Nombre según el inventario municipal",
    });
    expect(mail.sent.at(-1)).toMatchObject({ to: "ana@example.test" });
    const incoming = await ana.proposals.list({ status: "pending" });
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({
      incoming: true,
      changes: { name: "Parque del Oeste (rosaleda)", address: null },
      previousValues: { name: "Parque del Oeste", address: "Paseo de Ruperto Chapí" },
    });
    await expectApiError(
      concejalia.proposals.resolve(proposalId, { decision: "accept" }),
      "FORBIDDEN",
    );
    await ana.proposals.resolve(proposalId, { decision: "accept", note: "Gracias" });
    const updated = await ana.colonies.get(colonyId);
    expect(updated.colony).toMatchObject({ name: "Parque del Oeste (rosaleda)", address: null });
    expect(mail.sent.at(-1)).toMatchObject({ to: "concejalia@madrid.test" });

    // Cats too, and the town hall can withdraw a pending proposal.
    const { id: catProposal } = await concejalia.cats.propose(catId, {
      changes: { sex: "male" },
    });
    await concejalia.proposals.withdraw(catProposal);
    expect((await ana.proposals.list({ status: "withdrawn" })).map((p) => p.id)).toEqual([
      catProposal,
    ]);

    // --- Another municipality's town hall sees nothing ------------------------------
    const getafe = await root.admin.createTownHall({
      municipalityCode: GETAFE,
      adminEmail: "getafe@getafe.test",
    });
    expect(getafe.id).toBeTruthy();
    const getafeUser = clientFor(await signUp("getafe@getafe.test"));
    await getafeUser.invitations.accept(tokenFrom(mail.sent.at(-1)!.text));
    expect(await getafeUser.colonies.list()).toEqual([]);
    await expectApiError(getafeUser.colonies.get(colonyId), "NOT_FOUND");
    expect(
      (
        await request(`/api/v1/cats/${catId}/photo`, {
          cookie: (await signInCookie("getafe@getafe.test")) ?? "",
        })
      ).status,
    ).toBe(404);

    // --- Members and invitations ------------------------------------------------------
    const invite = await ana.organizations.invite({ email: "voluntaria@example.test" });
    expect(invite.emailSent).toBe(true);
    const memberToken = tokenFrom(mail.sent.at(-1)!.text);
    // The open invitation shows the emailed link, in case the email gets lost.
    expect(await ana.organizations.invitations()).toEqual([
      expect.objectContaining({
        email: "voluntaria@example.test",
        url: `http://localhost:3000/invitacion/${memberToken}`,
      }),
    ]);
    const voluntaria = clientFor(await signUp("voluntaria@example.test"));
    await voluntaria.invitations.accept(memberToken);
    expect(await ana.organizations.invitations()).toEqual([]);
    expect((await ana.organizations.members()).map((m) => [m.email, m.role])).toEqual([
      ["ana@example.test", "admin"],
      ["voluntaria@example.test", "member"],
    ]);
    // Members create cats and actions but not colonies.
    await expectApiError(
      voluntaria.colonies.create({ name: "Nueva", ...MADRID_POINT, municipalityCode: MADRID }),
      "FORBIDDEN",
    );
    await expectApiError(voluntaria.organizations.invite({ email: "x@example.test" }), "FORBIDDEN");

    // --- Daily reminders ---------------------------------------------------------------
    const { id: plannedId } = await ana.actions.create({
      actionType: "feeding",
      name: "Ronda de comida",
      scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      colonyId,
      participantIds: [me!.user.id],
    });
    expect(plannedId).toBeTruthy();
    const before = mail.sent.length;
    const first = await runActionReminders();
    const again = await runActionReminders();
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(again.sent).toBe(0);
    expect(mail.sent.length - before).toBe(first.sent);
  });

  async function signInCookie(email: string) {
    const response = await request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${++clientIp}` },
      body: JSON.stringify({ email, password: "correct horse battery" }),
    });
    return response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .find((c) => c.includes("session_token"));
  }
});
