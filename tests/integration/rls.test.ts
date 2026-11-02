/**
 * Row-level security and integrity rules, exercised directly against PostgreSQL as the
 * restricted `app_user` role (exactly what the API does for every request).
 */
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";

import {
  actionCats,
  colonyManagers,
  deletionRequests,
  actions,
  cats,
  changeProposals,
  colonies,
  getDb,
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
  withTenant,
} from "@felina/db";
import { hashToken } from "@felina/core/organizations";

import {
  addMember,
  createTownHallWith,
  createUser,
  describeDb,
  GETAFE,
  GETAFE_POINT,
  MADRID,
  MADRID_POINT,
  pgError,
  registerAssociationFor,
  resetData,
} from "./helpers.ts";

const colonyValues = (organizationId: string, createdBy: string, name = "Parque del Oeste") => ({
  organizationId,
  createdBy,
  name,
  ...MADRID_POINT,
  municipalityCode: MADRID,
});

const catValues = (organizationId: string, createdBy: string, colonyId: string | null = null) => ({
  organizationId,
  createdBy,
  colonyId,
  name: "Misi",
  sex: "female" as const,
  photoKey: `cats/${organizationId}/00000000-0000-0000-0000-000000000000.png`,
  ...MADRID_POINT,
  municipalityCode: MADRID,
});

const actionValues = (organizationId: string, createdBy: string, colonyId: string | null) => ({
  organizationId,
  createdBy,
  colonyId,
  municipalityCode: MADRID,
  actionType: "sterilization" as const,
  name: "Castración de Misi",
  scheduledAt: new Date(),
});

describeDb("row-level security", () => {
  let adminA: string;
  let memberA: string;
  let adminB: string;
  let madridUser: string;
  let getafeUser: string;
  let orgA: string;
  let orgB: string;

  beforeEach(async () => {
    await resetData();
    adminA = await createUser("admin-a@example.test");
    memberA = await createUser("member-a@example.test");
    adminB = await createUser("admin-b@example.test");
    madridUser = await createUser("madrid@example.test");
    getafeUser = await createUser("getafe@example.test");
    orgA = await registerAssociationFor(adminA, "Gatos del Oeste");
    orgB = await registerAssociationFor(adminB, "Otra asociación");
    await addMember(memberA, orgA);
    await createTownHallWith(madridUser, MADRID);
    await createTownHallWith(getafeUser, GETAFE);
  });

  async function colonyOfA() {
    return withTenant(adminA, async (tx) => {
      const [row] = await tx.insert(colonies).values(colonyValues(orgA, adminA)).returning();
      return row!.id;
    });
  }

  it("keeps pending associations out of the data", async () => {
    const pendingUser = await createUser("pending@example.test");
    const pending = await registerAssociationFor(pendingUser, "Pendiente", { approve: false });
    // Sees its own (pending) organization…
    const own = await withTenant(pendingUser, (tx) =>
      tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, pending)),
    );
    expect(own).toEqual([{ status: "pending" }]);
    // …but cannot create colonies or cats, nor see anyone else.
    expect(
      await pgError(() =>
        withTenant(pendingUser, (tx) =>
          tx.insert(colonies).values(colonyValues(pending, pendingUser)),
        ),
      ),
    ).toMatch(/row-level security/);
    const visible = await withTenant(pendingUser, (tx) =>
      tx.select({ id: organizations.id }).from(organizations),
    );
    expect(visible.map((o) => o.id)).toEqual([pending]);
  });

  it("lets admins create colonies, managers edit theirs and every member run actions", async () => {
    expect(
      await pgError(() =>
        withTenant(memberA, (tx) => tx.insert(colonies).values(colonyValues(orgA, memberA))),
      ),
    ).toMatch(/row-level security/);
    const colonyId = await colonyOfA();

    // A plain member registers cats without colony and actions anywhere, but not cats in
    // a colony they don't manage, nor edit that colony.
    expect(
      await pgError(() =>
        withTenant(memberA, (tx) => tx.insert(cats).values(catValues(orgA, memberA, colonyId))),
      ),
    ).toMatch(/row-level security/);
    const renamed = await withTenant(memberA, (tx) =>
      tx.update(colonies).set({ name: "Mía" }).where(eq(colonies.id, colonyId)).returning(),
    );
    expect(renamed).toHaveLength(0);
    const [looseCat] = await withTenant(memberA, (tx) =>
      tx.insert(cats).values(catValues(orgA, memberA)).returning(),
    );
    await withTenant(memberA, async (tx) => {
      const [action] = await tx
        .insert(actions)
        .values(actionValues(orgA, memberA, colonyId))
        .returning();
      await tx.insert(actionCats).values({ actionId: action!.id, catId: looseCat!.id });
    });

    // Only admins name managers; then the manager edits the colony and adds its cats.
    expect(
      await pgError(() =>
        withTenant(memberA, (tx) =>
          tx.insert(colonyManagers).values({ colonyId, userId: memberA, addedBy: memberA }),
        ),
      ),
    ).toMatch(/row-level security/);
    await withTenant(adminA, (tx) =>
      tx.insert(colonyManagers).values({ colonyId, userId: memberA, addedBy: adminA }),
    );
    await withTenant(memberA, async (tx) => {
      await tx.insert(cats).values(catValues(orgA, memberA, colonyId));
      await tx.update(colonies).set({ name: "Parque (norte)" }).where(eq(colonies.id, colonyId));
    });
    // Managers must be members of the colony's association.
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx.insert(colonyManagers).values({ colonyId, userId: adminB, addedBy: adminA }),
        ),
      ),
    ).toMatch(/must belong to the colony's association/);

    // Only admins delete, even what the member created; others file a request.
    const deleted = await withTenant(memberA, async (tx) => ({
      colonies: await tx.delete(colonies).where(eq(colonies.id, colonyId)).returning(),
      cats: await tx.delete(cats).where(eq(cats.id, looseCat!.id)).returning(),
    }));
    expect(deleted).toEqual({ colonies: [], cats: [] });
    const request = {
      organizationId: orgA,
      targetType: "cat" as const,
      catId: looseCat!.id,
      targetLabel: "Michi",
    };
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx.insert(deletionRequests).values({ ...request, requestedBy: adminA }),
        ),
      ),
    ).toMatch(/row-level security/);
    await withTenant(memberA, (tx) =>
      tx.insert(deletionRequests).values({ ...request, requestedBy: memberA }),
    );
    // Deleting the cat (an admin) approves the pending request.
    await withTenant(adminA, (tx) => tx.delete(cats).where(eq(cats.id, looseCat!.id)));
    const [approved] = await withTenant(memberA, (tx) => tx.select().from(deletionRequests));
    expect(approved).toMatchObject({ status: "approved", resolvedBy: adminA, catId: null });
  });

  it("isolates associations from each other", async () => {
    const colonyId = await colonyOfA();
    await withTenant(adminA, (tx) => tx.insert(cats).values(catValues(orgA, adminA, colonyId)));
    const seenByB = await withTenant(adminB, async (tx) => ({
      colonies: await tx.select().from(colonies),
      cats: await tx.select().from(cats),
    }));
    expect(seenByB).toEqual({ colonies: [], cats: [] });
    // B cannot attach its cat to A's colony, nor write into A.
    expect(
      await pgError(() =>
        withTenant(adminB, (tx) => tx.insert(cats).values(catValues(orgB, adminB, colonyId))),
      ),
    ).toMatch(/another organization/);
    expect(
      await pgError(() =>
        withTenant(adminB, (tx) => tx.insert(cats).values(catValues(orgA, adminB))),
      ),
    ).toMatch(/row-level security/);
    const updated = await withTenant(adminB, (tx) =>
      tx.update(colonies).set({ name: "Hackeada" }).where(eq(colonies.id, colonyId)).returning(),
    );
    expect(updated).toHaveLength(0);
  });

  it("shows the municipality's data to its town hall, read-only", async () => {
    const colonyId = await colonyOfA();
    await withTenant(adminA, async (tx) => {
      await tx.insert(cats).values(catValues(orgA, adminA, colonyId));
      await tx.insert(actions).values(actionValues(orgA, adminA, colonyId));
    });

    const madrid = await withTenant(madridUser, async (tx) => ({
      colonies: (await tx.select().from(colonies)).length,
      cats: (await tx.select().from(cats)).length,
      actions: (await tx.select().from(actions)).length,
    }));
    expect(madrid).toEqual({ colonies: 1, cats: 1, actions: 1 });

    const getafe = await withTenant(getafeUser, async (tx) => ({
      colonies: (await tx.select().from(colonies)).length,
      cats: (await tx.select().from(cats)).length,
      actions: (await tx.select().from(actions)).length,
    }));
    expect(getafe).toEqual({ colonies: 0, cats: 0, actions: 0 });

    // The town hall cannot edit, delete or create.
    const changed = await withTenant(madridUser, async (tx) => ({
      updated: await tx.update(colonies).set({ name: "Cambio" }).returning(),
      deleted: await tx.delete(colonies).returning(),
    }));
    expect(changed).toEqual({ updated: [], deleted: [] });
    const townHallOrg = (
      await getDb().select().from(organizations).where(eq(organizations.municipalityCode, MADRID))
    )[0]!.id;
    expect(
      await pgError(() =>
        withTenant(madridUser, (tx) => tx.insert(cats).values(catValues(townHallOrg, madridUser))),
      ),
    ).toMatch(/row-level security|association/);
  });

  it("lets only the town hall of the municipality authorize colonies and validate actions", async () => {
    const colonyId = await colonyOfA();
    const actionId = await withTenant(adminA, async (tx) => {
      const [row] = await tx
        .insert(actions)
        .values(actionValues(orgA, adminA, colonyId))
        .returning();
      return row!.id;
    });

    // Associations cannot self-authorize or self-validate.
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx.update(colonies).set({ authorizedAt: new Date() }).where(eq(colonies.id, colonyId)),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx
            .insert(colonies)
            .values({ ...colonyValues(orgA, adminA, "Otra"), authorizedAt: new Date() }),
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx.execute(sql`select app_set_action_validation(${actionId}, true)`),
        ),
      ),
    ).toMatch(/town hall only/);
    // Another municipality's town hall cannot either.
    expect(
      await pgError(() =>
        withTenant(getafeUser, (tx) =>
          tx.execute(sql`select app_set_colony_authorization(${colonyId}, true)`),
        ),
      ),
    ).toMatch(/not found/);

    await withTenant(madridUser, async (tx) => {
      await tx.execute(sql`select app_set_colony_authorization(${colonyId}, true)`);
      await tx.execute(sql`select app_set_action_validation(${actionId}, true)`);
    });
    const [colony] = await getDb().select().from(colonies).where(eq(colonies.id, colonyId));
    const [action] = await getDb().select().from(actions).where(eq(actions.id, actionId));
    expect(colony!.authorizedBy).toBe(madridUser);
    expect(action!.validatedBy).toBe(madridUser);

    // Moving the colony to another municipality drops the old authorization.
    await withTenant(adminA, (tx) =>
      tx
        .update(colonies)
        .set({ municipalityCode: GETAFE, ...GETAFE_POINT })
        .where(eq(colonies.id, colonyId)),
    );
    const [moved] = await getDb().select().from(colonies).where(eq(colonies.id, colonyId));
    expect(moved!.authorizedAt).toBeNull();
  });

  it("routes change proposals from the town hall to the managing association's admins", async () => {
    const colonyId = await colonyOfA();
    const townHall = (
      await getDb().select().from(organizations).where(eq(organizations.municipalityCode, MADRID))
    )[0]!.id;
    const insertProposal = (userId: string, orgId: string) =>
      withTenant(userId, async (tx) => {
        const [row] = await tx
          .insert(changeProposals)
          .values({
            targetType: "colony",
            colonyId,
            proposedByOrganizationId: orgId,
            proposedBy: userId,
            changes: { name: "Parque del Oeste (norte)" },
          })
          .returning();
        return row!;
      });

    // Only the town hall of the colony's municipality may propose.
    const getafeOrg = (
      await getDb().select().from(organizations).where(eq(organizations.municipalityCode, GETAFE))
    )[0]!.id;
    expect(await pgError(() => insertProposal(getafeUser, getafeOrg))).toMatch(
      /row-level security/,
    );
    expect(await pgError(() => insertProposal(adminB, orgB))).toMatch(/row-level security/);

    const proposal = await insertProposal(madridUser, townHall);
    expect(proposal.targetOrganizationId).toBe(orgA);

    // The proposer cannot accept its own proposal; B does not even see it.
    const selfAccepted = await withTenant(madridUser, (tx) =>
      tx
        .update(changeProposals)
        .set({ status: "accepted", resolvedBy: madridUser })
        .where(eq(changeProposals.id, proposal.id))
        .returning()
        .catch(() => "denied"),
    );
    expect(selfAccepted).toBe("denied");
    expect(await withTenant(adminB, (tx) => tx.select().from(changeProposals))).toEqual([]);

    // A plain member of A cannot resolve it; an admin can.
    const byMember = await withTenant(memberA, (tx) =>
      tx
        .update(changeProposals)
        .set({ status: "accepted", resolvedBy: memberA })
        .where(eq(changeProposals.id, proposal.id))
        .returning(),
    );
    expect(byMember).toHaveLength(0);
    const byAdmin = await withTenant(adminA, (tx) =>
      tx
        .update(changeProposals)
        .set({ status: "rejected", resolvedBy: adminA, resolvedAt: new Date() })
        .where(eq(changeProposals.id, proposal.id))
        .returning(),
    );
    expect(byAdmin[0]?.status).toBe("rejected");
  });

  it("protects memberships and the super-admin flag", async () => {
    const outsider = await createUser("outsider@example.test");
    expect(
      await pgError(() =>
        withTenant(outsider, (tx) =>
          tx
            .insert(organizationMembers)
            .values({ userId: outsider, organizationId: orgA, role: "admin" }),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await pgError(() =>
        withTenant(outsider, (tx) =>
          tx.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, outsider)),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx.execute(sql`select app_review_organization(${orgB}, 'suspended', null)`),
        ),
      ),
    ).toMatch(/platform admin only/);
    // Members cannot promote themselves.
    const promoted = await withTenant(memberA, (tx) =>
      tx
        .update(organizationMembers)
        .set({ role: "admin" })
        .where(eq(organizationMembers.userId, memberA))
        .returning(),
    );
    expect(promoted).toHaveLength(0);
    // The last admin cannot step down while others remain.
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx
            .update(organizationMembers)
            .set({ role: "member" })
            .where(eq(organizationMembers.userId, adminA)),
        ),
      ),
    ).toMatch(/at least one admin/);
  });

  it("accepts invitations only for the invited email and one organization per person", async () => {
    const token = "invitation-token-for-tests-0123456789";
    await withTenant(adminA, (tx) =>
      tx.insert(organizationInvitations).values({
        organizationId: orgA,
        email: "nueva@example.test",
        role: "member",
        tokenHash: hashToken(token),
        invitedBy: adminA,
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );
    const accept = (userId: string) =>
      withTenant(userId, (tx) =>
        tx.execute(sql`select app_accept_invitation(${hashToken(token)}) as id`),
      );

    expect(await pgError(() => accept(adminB))).toMatch(/another email|already belongs/);
    const invited = await createUser("Nueva@Example.test");
    await accept(invited);
    const [membership] = await getDb()
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, invited));
    expect(membership).toMatchObject({ organizationId: orgA, role: "member" });
    expect(await pgError(() => accept(invited))).toMatch(/not valid/);
  });

  it("allows a single town hall per municipality", async () => {
    const other = await createUser("otro-madrid@example.test");
    expect(await pgError(() => createTownHallWith(other, MADRID))).toMatch(/duplicate key/);
  });

  it("lets the super admin review organizations and register town halls", async () => {
    const root = await createUser("root@example.test", { platformAdmin: true });
    const pendingUser = await createUser("p@example.test");
    const pending = await registerAssociationFor(pendingUser, "Pendiente", { approve: false });
    await withTenant(root, (tx) =>
      tx.execute(
        sql`select app_review_organization(${pending}, 'approved', 'Documentación correcta')`,
      ),
    );
    const [org] = await getDb().select().from(organizations).where(eq(organizations.id, pending));
    expect(org).toMatchObject({ status: "approved", reviewedBy: root });

    // Nobody else can create organizations directly, and never an association.
    expect(
      await pgError(() =>
        withTenant(adminA, (tx) =>
          tx
            .insert(organizations)
            .values({ kind: "town_hall", name: "Falso", municipalityCode: "41091" }),
        ),
      ),
    ).toMatch(/row-level security/);
    expect(
      await pgError(() =>
        withTenant(root, (tx) =>
          tx.insert(organizations).values({ kind: "association", name: "X" }),
        ),
      ),
    ).toMatch(/row-level security/);
    await withTenant(root, (tx) =>
      tx.insert(organizations).values({
        kind: "town_hall",
        name: "Ayuntamiento de Sevilla",
        municipalityCode: "41091",
        status: "approved",
      }),
    );
    const sevilla = await getDb()
      .select()
      .from(organizations)
      .where(and(eq(organizations.kind, "town_hall"), eq(organizations.municipalityCode, "41091")));
    expect(sevilla).toHaveLength(1);
  });
});
