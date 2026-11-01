import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { describe } from "vite-plus/test";

import { getDb, users, withTenant } from "@licita/db";
import { parseFeed } from "@licita/procurement/placsp/parser";
import type { RawArchive, SourceConnector, SourcePage } from "@licita/procurement/types";
import type { EmailMessage, Mailer } from "@licita/notifications/mailer";

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
/** Integration suites are skipped unless TEST_DATABASE_URL is configured. */
export const describeDb = describe.skipIf(!hasTestDatabase);

export const FIXTURE = readFileSync(
  new URL("../../packages/procurement/tests/fixtures/placsp/feed-page-1.atom", import.meta.url),
  "utf8",
);

/** Connector serving in-memory feed documents (no network). */
export function documentsConnector(documents: string[]): SourceConnector {
  return {
    id: "placsp_direct",
    label: "Fixture",
    defaultUrl: "fixture://page-1",
    async *pages({ maxPages }) {
      for (const [i, doc] of documents.slice(0, maxPages).entries()) {
        const page: SourcePage = {
          url: `fixture://page-${i + 1}`,
          raw: { body: doc, contentType: "application/atom+xml", extension: "atom" },
          ...parseFeed(doc),
        };
        yield page;
      }
    },
  };
}

export async function resetData() {
  await getDb().execute(sql`
    truncate users, companies, contracting_authorities, tenders, import_runs, auth_verifications
    restart identity cascade
  `);
}

/** Archive that keeps objects in memory, optionally failing every write. */
export function memoryArchive(options: { fail?: boolean } = {}) {
  const objects = new Map<string, { body: string; contentType: string }>();
  const archive: RawArchive = {
    async put({ key, body, contentType }) {
      if (options.fail) throw new Error("simulated storage outage");
      objects.set(key, { body, contentType });
    },
  };
  return { archive, objects };
}

export async function createUser(email: string): Promise<string> {
  const [row] = await getDb()
    .insert(users)
    .values({ email, fullName: email })
    .returning({ id: users.id });
  return row!.id;
}

export async function createCompanyFor(userId: string, name: string): Promise<string> {
  return withTenant(userId, async (tx) => {
    const result = await tx.execute<{ id: string }>(
      sql`select app_create_company(${name}, null, null, null, null, null, null) as id`,
    );
    return result.rows[0]!.id;
  });
}

export function recordingMailer(behaviour: "ok" | "retryable" | "fatal" = "ok") {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = {
    name: "test",
    async send(message) {
      if (behaviour !== "ok") {
        const { MailerError } = await import("@licita/notifications/mailer");
        throw new MailerError(`simulated ${behaviour} failure`, behaviour === "retryable");
      }
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
