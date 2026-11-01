/** API server process: `vp run --filter @licita/api dev` (watch) or `node dist/index.mjs`. */
import { loadEnv } from "@licita/db/env";

loadEnv();

const { serve } = await import("@hono/node-server");
const { closeDb } = await import("@licita/db");
const { createApp } = await import("./app.ts");
const { apiEnv } = await import("./env.ts");

const port = apiEnv().API_PORT;
const server = serve({ fetch: createApp({ log: true }).fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
});

function shutdown(signal: string) {
  console.log(`[api] ${signal}: shutting down`);
  server.close(() => {
    void closeDb().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
