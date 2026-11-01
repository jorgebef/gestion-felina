import { sql } from "drizzle-orm";
import { describe } from "vite-plus/test";

import { getDb, organizationMembers, organizations, users, withTenant } from "@felina/db";
import type { EmailMessage, Mailer } from "@felina/notifications/mailer";

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
/** Integration suites are skipped unless TEST_DATABASE_URL is configured. */
export const describeDb = describe.skipIf(!hasTestDatabase);

/** INE codes used in the tests. */
export const MADRID = "28079";
export const GETAFE = "28065";

export const MADRID_POINT = { latitude: 40.4168, longitude: -3.7038 };
export const GETAFE_POINT = { latitude: 40.3057, longitude: -3.7329 };

/** 1×1 transparent PNG. */
export const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
);

export async function resetData() {
  await getDb().execute(sql`
    truncate users, organizations, notification_deliveries, auth_verifications
    restart identity cascade
  `);
}

export async function createUser(email: string, options: { platformAdmin?: boolean } = {}) {
  const [row] = await getDb()
    .insert(users)
    .values({
      email,
      fullName: email.split("@")[0],
      isPlatformAdmin: options.platformAdmin ?? false,
    })
    .returning({ id: users.id });
  return row!.id;
}

/** Registers an association through the same function the API uses. */
export async function registerAssociationFor(
  userId: string,
  name: string,
  options: { approve?: boolean } = { approve: true },
): Promise<string> {
  const id = await withTenant(userId, async (tx) => {
    const result = await tx.execute<{ id: string }>(
      sql`select app_register_association(${name}, null, null, null, null, null) as id`,
    );
    return result.rows[0]!.id;
  });
  if (options.approve !== false) {
    await getDb().execute(sql`update organizations set status = 'approved' where id = ${id}`);
  }
  return id;
}

/** A town hall (approved) with `userId` as its admin. Owner connection. */
export async function createTownHallWith(userId: string, municipalityCode: string) {
  const [org] = await getDb()
    .insert(organizations)
    .values({
      kind: "town_hall",
      name: `Ayuntamiento ${municipalityCode}`,
      municipalityCode,
      status: "approved",
    })
    .returning({ id: organizations.id });
  await getDb()
    .insert(organizationMembers)
    .values({ userId, organizationId: org!.id, role: "admin" });
  return org!.id;
}

/** Adds a plain member to an organization (owner connection). */
export async function addMember(
  userId: string,
  organizationId: string,
  role: "admin" | "member" = "member",
) {
  await getDb().insert(organizationMembers).values({ userId, organizationId, role });
}

export function recordingMailer() {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = {
    name: "test",
    async send(message) {
      sent.push(message);
      return { providerMessageId: `test-${sent.length}` };
    },
  };
  return { mailer, sent };
}

/** Message of the Postgres error behind a failed query (Drizzle wraps it in `cause`). */
export async function pgError(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  return "no error";
}
