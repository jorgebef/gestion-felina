/**
 * Loads the official CPV 2008 catalogue (packages/db/data/cpv-2008.tsv, extracted from the
 * PLACSP CODICE code list) into `cpv_codes`. Safe to re-run: rows are upserted.
 *
 *   vp run db:seed
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { databaseUrl, loadEnv } from "./env.ts";

const DATA_FILE = path.resolve(import.meta.dirname, "../data/cpv-2008.tsv");

export async function seedCpv(connectionString: string): Promise<number> {
  const rows = (await readFile(DATA_FILE, "utf8"))
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t") as [string, string]);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      await client.query(
        `INSERT INTO cpv_codes (code, label_es)
         SELECT * FROM unnest($1::text[], $2::text[])
         ON CONFLICT (code) DO UPDATE SET label_es = EXCLUDED.label_es`,
        [chunk.map((r) => r[0]), chunk.map((r) => r[1])],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
  return rows.length;
}

if (import.meta.main) {
  loadEnv();
  const url = databaseUrl();
  console.log(`CPV codes loaded: ${await seedCpv(url)}`);
}
