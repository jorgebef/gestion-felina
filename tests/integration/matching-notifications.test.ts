import { eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";

import { getDb, alertProfiles, notificationDeliveries, tenderMatches } from "@licita/db";
import { runImport } from "@licita/procurement/pipeline";
import { runMatching } from "@licita/matching/engine";
import { runDigest, sendTestNotification } from "@licita/notifications/service";

import {
  createCompanyFor,
  createUser,
  describeDb,
  documentsConnector,
  FIXTURE,
  recordingMailer,
  resetData,
} from "./helpers.ts";

// The fixture's open tender has its deadline on 2026-11-11.
const now = new Date("2026-10-23T08:00:00Z");

async function setup() {
  await resetData();
  await runImport(documentsConnector([FIXTURE]), { maxPages: 1 });
  const userId = await createUser("ana@example.test");
  const companyId = await createCompanyFor(userId, "Depuraciones S.L.");
  const [profile] = await getDb()
    .insert(alertProfiles)
    .values({
      companyId,
      name: "Depuradoras",
      serviceDescription: "Construcción de estaciones depuradoras de aguas residuales",
      cpvCodes: ["45000000"],
      includeKeywords: ["depuradora"],
      nationwide: true,
      emailFrequency: "daily",
    })
    .returning({ id: alertProfiles.id });
  return { userId, companyId, profileId: profile!.id };
}

describeDb("matching engine", () => {
  beforeEach(resetData);

  it("stores explained matches for open tenders only, idempotently", async () => {
    const { profileId } = await setup();
    const first = await runMatching({ now });
    expect(first).toMatchObject({ profiles: 1, candidates: 1, matches: 1, newMatches: 1 });
    const [match] = await getDb()
      .select()
      .from(tenderMatches)
      .where(eq(tenderMatches.alertProfileId, profileId));
    expect(Number(match!.score)).toBeGreaterThan(60);
    expect(match!.matchReason).toContain("Palabras clave encontradas: «depuradora»");

    const second = await runMatching({ now });
    expect(second).toMatchObject({ matches: 1, newMatches: 0 });
    expect(await getDb().select().from(tenderMatches)).toHaveLength(1);
  });

  it("drops matches that no longer fit, but keeps those with user feedback", async () => {
    const { profileId } = await setup();
    await runMatching({ now });
    await getDb()
      .update(alertProfiles)
      .set({ excludeKeywords: ["residuales"] })
      .where(eq(alertProfiles.id, profileId));
    expect(await runMatching({ now })).toMatchObject({ matches: 0, removed: 1 });

    await getDb()
      .update(alertProfiles)
      .set({ excludeKeywords: [] })
      .where(eq(alertProfiles.id, profileId));
    await runMatching({ now });
    await getDb().update(tenderMatches).set({ feedback: "relevant" });
    await getDb()
      .update(alertProfiles)
      .set({ excludeKeywords: ["residuales"] })
      .where(eq(alertProfiles.id, profileId));
    expect(await runMatching({ now })).toMatchObject({ removed: 0 });
  });

  it("ignores inactive profiles", async () => {
    const { profileId } = await setup();
    await getDb()
      .update(alertProfiles)
      .set({ isActive: false })
      .where(eq(alertProfiles.id, profileId));
    expect(await runMatching({ now })).toMatchObject({ profiles: 0, matches: 0 });
  });
});

describeDb("digest notifications", () => {
  beforeEach(resetData);

  it("sends one digest and never the same tender twice", async () => {
    await setup();
    await runMatching({ now });
    const { mailer, sent } = recordingMailer();

    expect(await runDigest("daily", { now, mailer })).toMatchObject({
      emailsSent: 1,
      deliveriesSent: 1,
    });
    expect(sent[0]!.to).toBe("ana@example.test");
    expect(sent[0]!.text).toContain("Estacion Depuradora de Aguas Residuales");
    expect(sent[0]!.text).toContain("contrataciondelestado.es");

    expect(await runDigest("daily", { now, mailer })).toMatchObject({ emailsSent: 0 });
    expect(
      await runDigest("daily", { now: new Date(now.getTime() + 3_600_000), mailer }),
    ).toMatchObject({ emailsSent: 0 });
    expect(sent).toHaveLength(1);
    const deliveries = await getDb().select().from(notificationDeliveries);
    expect(deliveries).toEqual([
      expect.objectContaining({ status: "sent", providerMessageId: "test-1", attemptCount: 1 }),
    ]);
  });

  it("only sends to profiles with that frequency", async () => {
    await setup();
    await runMatching({ now });
    const { mailer, sent } = recordingMailer();
    expect(await runDigest("weekly", { now, mailer })).toMatchObject({ emailsSent: 0 });
    expect(sent).toHaveLength(0);
  });

  it("skips matches the user dismissed", async () => {
    await setup();
    await runMatching({ now });
    await getDb().update(tenderMatches).set({ feedback: "irrelevant" });
    const { mailer, sent } = recordingMailer();
    await runDigest("daily", { now, mailer });
    expect(sent).toHaveLength(0);
  });

  it("retries temporary provider errors, without duplicating once sent", async () => {
    await setup();
    await runMatching({ now });
    const down = recordingMailer("retryable");
    expect(await runDigest("daily", { now, mailer: down.mailer })).toMatchObject({
      emailsFailed: 1,
    });
    const [failed] = await getDb().select().from(notificationDeliveries);
    expect(failed).toMatchObject({ status: "failed", attemptCount: 1 });
    expect(failed!.errorMessage).toContain("simulated retryable failure");

    const up = recordingMailer();
    expect(await runDigest("daily", { now, mailer: up.mailer })).toMatchObject({ emailsSent: 1 });
    expect(await runDigest("daily", { now, mailer: up.mailer })).toMatchObject({ emailsSent: 0 });
    expect(up.sent).toHaveLength(1);
  });

  it("does not retry permanent errors", async () => {
    await setup();
    await runMatching({ now });
    await runDigest("daily", { now, mailer: recordingMailer("fatal").mailer });
    const up = recordingMailer();
    await runDigest("daily", { now, mailer: up.mailer });
    expect(up.sent).toHaveLength(0);
  });

  it("sends a throttled test email to a company member only", async () => {
    const { userId, companyId } = await setup();
    await runMatching({ now });
    const { mailer, sent } = recordingMailer();
    expect(await sendTestNotification({ userId, companyId }, { now, mailer })).toMatchObject({
      status: "sent",
      tenders: 1,
    });
    expect(await sendTestNotification({ userId, companyId }, { now, mailer })).toMatchObject({
      status: "throttled",
    });
    expect(sent).toHaveLength(1);

    const outsider = await createUser("intruso@example.test");
    await expect(
      sendTestNotification({ userId: outsider, companyId }, { now, mailer }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
