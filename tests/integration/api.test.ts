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
  describeDb,
  GETAFE,
  MADRID,
  MADRID_POINT,
  PNG,
  recordingMailer,
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
