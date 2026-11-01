import { beforeEach, expect, it } from "vite-plus/test";

import { createApp } from "@licita/api";
import { ApiError, createApi } from "@licita/api-client";

import { describeDb, resetData } from "./helpers.ts";

const ORIGIN = "http://localhost:3000";
const app = createApp();

function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", ORIGIN);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
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

const PROFILE = {
  name: "Limpieza",
  serviceDescription: "Limpieza de edificios públicos y oficinas",
  sectors: ["limpieza"],
  cpvCodes: ["90910000"],
  includeKeywords: ["limpieza"],
  excludeKeywords: [],
  provinceCodes: [],
  nationwide: true,
  contractTypes: ["services"],
  minBudgetEur: null,
  maxBudgetEur: null,
  emailFrequency: "daily",
  isActive: true,
};

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
  beforeEach(resetData);

  it("treats anonymous visitors as such", async () => {
    expect(await (await request("/api/v1/me")).json()).toBeNull();
    const response = await request("/api/v1/dashboard");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("runs onboarding: sign-up → company → alert profile", async () => {
    const cookie = await signUp("ana@example.test");
    const api = clientFor(cookie);

    expect(await api.me.get()).toMatchObject({
      user: { email: "ana@example.test" },
      company: null,
    });
    await expect(api.dashboard.get()).rejects.toMatchObject({ status: 403, code: "NO_COMPANY" });

    await api.companies.create({ legalName: "Limpiezas Ana S.L." });
    expect(await api.me.get()).toMatchObject({
      company: { name: "Limpiezas Ana S.L.", role: "owner" },
    });

    const created = await api.alertProfiles.create(PROFILE as never);
    const profiles = await api.alertProfiles.list();
    expect(profiles.map((p) => p.id)).toEqual([created.id]);
    expect((await api.dashboard.get()).profiles).toEqual({ total: 1, active: 1 });
  });

  it("rejects invalid input with a readable message", async () => {
    const cookie = await signUp("val@example.test");
    const api = clientFor(cookie);
    await api.companies.create({ legalName: "Validaciones S.L." });

    const error = await api.alertProfiles
      .create({ ...PROFILE, name: "x" } as never)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION",
      message: "Pon un nombre al perfil",
    });

    await expect(api.alertProfiles.get("not-a-uuid")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION",
    });
  });

  it("keeps each company's data private", async () => {
    const ana = clientFor(await signUp("ana@example.test"));
    await ana.companies.create({ legalName: "Empresa A" });
    const { id } = await ana.alertProfiles.create(PROFILE as never);

    const bob = clientFor(await signUp("bob@example.test"));
    await bob.companies.create({ legalName: "Empresa B" });

    await expect(bob.alertProfiles.get(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      bob.alertProfiles.update(id, { ...PROFILE, name: "Robado" } as never),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(bob.alertProfiles.delete(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await bob.alertProfiles.list()).toEqual([]);
    expect((await ana.alertProfiles.get(id)).name).toBe("Limpieza");
  });

  it("lets the owner edit the company", async () => {
    const api = clientFor(await signUp("own@example.test"));
    await api.companies.create({ legalName: "Propietaria S.L." });
    await api.companies.updateCurrent({ legalName: "Propietaria Renombrada S.L." });
    expect((await api.companies.current()).company.legalName).toBe("Propietaria Renombrada S.L.");
  });

  it("blocks cross-site form posts", async () => {
    const response = await app.request(`${ORIGIN}/api/v1/companies`, {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "legalName=x",
    });
    expect(response.status).toBe(403);
  });
});
