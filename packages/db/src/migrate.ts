/**
 * Applies packages/db/migrations/*.sql in order and records them in `schema_migrations`.
 * Idempotent: already-applied versions are skipped, and a changed file is reported
 * instead of being re-run (write a new migration rather than editing an old one).
 *
 *   vp run db:migrate
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { databaseUrl, loadEnv } from "./env.ts";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../migrations");

export async function migrate(connectionString: string, log = console.log): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const applied = new Map(
      (
        await client.query<{ version: string; checksum: string }>(
          "SELECT version, checksum FROM schema_migrations",
        )
      ).rows.map((r) => [r.version, r.checksum]),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const content = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      const checksum = createHash("sha256").update(content).digest("hex");
      const previous = applied.get(version);
      if (previous) {
        if (previous !== checksum) log(`! ${version} changed after being applied (ignored)`);
        continue;
      }
      // A migration may manage its own BEGIN/COMMIT; otherwise it is wrapped here.
      const managesTransaction = /^\s*BEGIN\s*;/im.test(content);
      try {
        if (!managesTransaction) await client.query("BEGIN");
        await client.query(content);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [
          version,
          checksum,
        ]);
        if (!managesTransaction) await client.query("COMMIT");
        log(`✓ ${version}`);
      } catch (error) {
        if (!managesTransaction) await client.query("ROLLBACK");
        throw new Error(`Migration ${version} failed: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  loadEnv();
  const url = databaseUrl();
  await migrate(url);
}
