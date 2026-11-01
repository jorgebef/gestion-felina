import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vite-plus/test";

import {
  getDb,
  alertProfiles,
  companies,
  companyMembers,
  companySubscriptions,
  notificationDeliveries,
  tenderMatches,
  tenderTasks,
  tenders,
  trackedTenders,
  users,
  withTenant,
} from "@licita/db";
import { runImport } from "@licita/procurement/pipeline";

import {
  createCompanyFor,
  createUser,
  describeDb,
  documentsConnector,
  FIXTURE,
  pgError,
  resetData,
} from "./helpers.ts";

/**
 * Tenant isolation is enforced by Postgres (db/migrations/0004_rls.sql), so these tests
 * talk to the database exactly as the web server does: through withTenant().
 */
describeDb("row level security between companies", () => {
  let alice: string;
  let bob: string;
  let aliceCompany: string;
  let bobCompany: string;
  let aliceProfile: string;
  let aliceTracked: string;
  let tenderId: string;

  beforeAll(async () => {
    await resetData();
    await runImport(documentsConnector([FIXTURE]), { maxPages: 1 });
    [{ id: tenderId }] = (await getDb().select({ id: tenders.id }).from(tenders).limit(1)) as [
      { id: string },
    ];

    alice = await createUser("alice@example.test");
    bob = await createUser("bob@example.test");
    aliceCompany = await createCompanyFor(alice, "Alice S.L.");
    bobCompany = await createCompanyFor(bob, "Bob S.L.");

    await withTenant(alice, async (tx) => {
      [{ id: aliceProfile }] = (await tx
        .insert(alertProfiles)
        .values({
          companyId: aliceCompany,
          name: "Privado",
          serviceDescription: "Obras de depuradoras",
          nationwide: true,
        })
        .returning({ id: alertProfiles.id })) as [{ id: string }];
      [{ id: aliceTracked }] = (await tx
        .insert(trackedTenders)
        .values({ companyId: aliceCompany, tenderId, notes: "Nota confidencial" })
        .returning({ id: trackedTenders.id })) as [{ id: string }];
      await tx
        .insert(tenderTasks)
        .values({ trackedTenderId: aliceTracked, title: "Tarea privada" });
    });
    // Rows only internal jobs can create.
    await getDb()
      .insert(tenderMatches)
      .values({ alertProfileId: aliceProfile, tenderId, score: 80 });
    await getDb().insert(notificationDeliveries).values({
      userId: alice,
      companyId: aliceCompany,
      notificationType: "test",
      dedupeKey: "rls-test",
    });
  });

  it("creates the company with the caller as owner and a free plan", async () => {
    const members = await getDb()
      .select()
      .from(companyMembers)
      .where(eq(companyMembers.companyId, aliceCompany));
    expect(members).toEqual([expect.objectContaining({ userId: alice, role: "owner" })]);
    const [plan] = await getDb()
      .select()
      .from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, aliceCompany));
    expect(plan).toMatchObject({ planCode: "free", status: "active" });
  });

  it("lets each user see only their own company's private rows", async () => {
    const seenBy = (userId: string) =>
      withTenant(userId, async (tx) => ({
        companies: (await tx.select().from(companies)).map((c) => c.legalName),
        profiles: (await tx.select().from(alertProfiles)).length,
        tracked: (await tx.select().from(trackedTenders)).length,
        tasks: (await tx.select().from(tenderTasks)).length,
        matches: (await tx.select().from(tenderMatches)).length,
        deliveries: (await tx.select().from(notificationDeliveries)).length,
        subscriptions: (await tx.select().from(companySubscriptions)).length,
        members: (await tx.select().from(companyMembers)).length,
        users: (await tx.select({ email: users.email }).from(users)).map((u) => u.email),
      }));
    expect(await seenBy(alice)).toEqual({
      companies: ["Alice S.L."],
      profiles: 1,
      tracked: 1,
      tasks: 1,
      matches: 1,
      deliveries: 1,
      subscriptions: 1,
      members: 1,
      users: ["alice@example.test"],
    });
    expect(await seenBy(bob)).toEqual({
      companies: ["Bob S.L."],
      profiles: 0,
      tracked: 0,
      tasks: 0,
      matches: 0,
      deliveries: 0,
      subscriptions: 1,
      members: 1,
      users: ["bob@example.test"],
    });
  });

  it("resolves each user to their own company", async () => {
    const ids = await withTenant(bob, (tx) => tx.select({ id: companies.id }).from(companies));
    expect(ids).toEqual([{ id: bobCompany }]);
  });

  it("shares public tender data with everyone", async () => {
    const count = (u: string) =>
      withTenant(u, async (tx) => (await tx.select().from(tenders)).length);
    expect(await count(alice)).toBe(2);
    expect(await count(bob)).toBe(2);
  });

  it("prevents modifying or deleting another company's data", async () => {
    await withTenant(bob, async (tx) => {
      const updated = await tx
        .update(alertProfiles)
        .set({ name: "Hackeado" })
        .where(eq(alertProfiles.id, aliceProfile))
        .returning();
      const deleted = await tx
        .delete(trackedTenders)
        .where(eq(trackedTenders.id, aliceTracked))
        .returning();
      const feedback = await tx.update(tenderMatches).set({ feedback: "irrelevant" }).returning();
      const company = await tx
        .update(companies)
        .set({ legalName: "Hackeado" })
        .where(eq(companies.id, aliceCompany))
        .returning();
      expect([updated, deleted, feedback, company].map((r) => r.length)).toEqual([0, 0, 0, 0]);
    });
    const [profile] = await getDb()
      .select()
      .from(alertProfiles)
      .where(eq(alertProfiles.id, aliceProfile));
    expect(profile!.name).toBe("Privado");
  });

  it("rejects writing rows into another company", async () => {
    expect(
      await pgError(() =>
        withTenant(bob, (tx) =>
          tx
            .insert(alertProfiles)
            .values({ companyId: aliceCompany, name: "x", serviceDescription: "x x x" }),
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await pgError(() =>
        withTenant(bob, (tx) =>
          tx.insert(tenderTasks).values({ trackedTenderId: aliceTracked, title: "x" }),
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await pgError(() =>
        withTenant(bob, (tx) =>
          tx.insert(trackedTenders).values({ companyId: aliceCompany, tenderId }),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("does not allow assigning work to people outside the company", async () => {
    expect(
      await pgError(() =>
        withTenant(alice, (tx) =>
          tx
            .update(trackedTenders)
            .set({ assignedUserId: bob })
            .where(eq(trackedTenders.id, aliceTracked)),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("makes privilege escalation impossible", async () => {
    // Joining or promoting oneself in any company.
    expect(
      await pgError(() =>
        withTenant(bob, (tx) =>
          tx.insert(companyMembers).values({ companyId: aliceCompany, userId: bob, role: "owner" }),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await pgError(() =>
        withTenant(alice, (tx) =>
          tx.update(companyMembers).set({ role: "admin" }).where(eq(companyMembers.userId, alice)),
        ),
      ),
    ).toMatch(/permission denied/);
    // Changing the subscription from the app.
    expect(
      await pgError(() =>
        withTenant(alice, (tx) =>
          tx
            .update(companySubscriptions)
            .set({ planCode: "pro" })
            .where(eq(companySubscriptions.companyId, aliceCompany)),
        ),
      ),
    ).toMatch(/permission denied/);
    // Creating matches or notifications reserved to internal jobs.
    expect(
      await pgError(() =>
        withTenant(alice, (tx) =>
          tx.insert(tenderMatches).values({ alertProfileId: aliceProfile, tenderId, score: 100 }),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await pgError(() => withTenant(alice, (tx) => tx.update(tenderMatches).set({ score: 100 }))),
    ).toMatch(/permission denied/);
    // Writing public data.
    expect(
      await pgError(() => withTenant(alice, (tx) => tx.update(tenders).set({ title: "x" }))),
    ).toMatch(/permission denied/);
  });

  it("keeps authentication tables out of reach", async () => {
    expect(
      await pgError(() => withTenant(alice, (tx) => tx.execute(sql`select * from auth_accounts`))),
    ).toMatch(/permission denied/);
    expect(
      await pgError(() => withTenant(alice, (tx) => tx.execute(sql`select * from auth_sessions`))),
    ).toMatch(/permission denied/);
  });

  it("requires an authenticated user to create a company", async () => {
    expect(
      await pgError(() =>
        getDb().transaction(async (tx) => {
          await tx.execute(sql`set local role app_user`);
          await tx.execute(sql`select app_create_company('x', null, null, null, null, null, null)`);
        }),
      ),
    ).toMatch(/no authenticated user/);
  });
});
