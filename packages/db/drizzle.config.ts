import { defineConfig } from "drizzle-kit";

import { databaseUrl, loadEnv } from "./src/env.ts";

loadEnv();

// Used only for `drizzle-kit studio`; the schema is managed by the SQL files in ./migrations.
export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
});
