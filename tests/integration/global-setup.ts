import { config } from "dotenv";
import { Client } from "pg";

import { migrate } from "@felina/db/migrate";
import { seedMunicipalities } from "@felina/db/seed-municipalities";

/** Recreates the test database schema from the versioned migrations. */
export default async function setup() {
  config({ path: [".env.local", ".env"], quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  if (url === process.env.DATABASE_URL && !/test/i.test(url)) {
    throw new Error("TEST_DATABASE_URL must point to a disposable test database");
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  await migrate(url, () => {});
  await seedMunicipalities(url);
}
