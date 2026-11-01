import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { databaseUrl } from "./env.ts";
import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>;

function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10 });
  return drizzle(pool, { schema });
}

let instance: Database | undefined;

/**
 * Connection used by Better Auth and internal jobs. It runs as the database owner and
 * therefore bypasses RLS: request handlers must use `withTenant` (./tenant.ts) instead.
 */
export function getDb(): Database {
  instance ??= createDatabase(databaseUrl());
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.$client.end();
    instance = undefined;
  }
}
