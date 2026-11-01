/**
 * Loads the INE municipality list (data/municipios-ine-2025.tsv: code, official name;
 * "Relación de municipios y códigos a 1 de enero de 2025") into `municipalities`.
 * Safe to re-run: rows are upserted.
 *
 *   vp run db:seed
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { municipalityDisplayName } from "@felina/domain/municipalities";

import { databaseUrl, loadEnv } from "./env.ts";

const DATA_FILE = path.resolve(import.meta.dirname, "../data/municipios-ine-2025.tsv");

export async function seedMunicipalities(connectionString: string): Promise<number> {
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
        `INSERT INTO municipalities (code, province_code, name, official_name)
         SELECT code, left(code, 2), name, official
         FROM unnest($1::text[], $2::text[], $3::text[]) AS t(code, name, official)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name, official_name = EXCLUDED.official_name`,
        [
          chunk.map((r) => r[0]),
          chunk.map((r) => municipalityDisplayName(r[1])),
          chunk.map((r) => r[1]),
        ],
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
  console.log(`Municipios cargados: ${await seedMunicipalities(databaseUrl())}`);
}
