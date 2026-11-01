/**
 * Runs one job and exits (manual runs, or an external scheduler instead of ./index.ts).
 *
 *   vp run job reminders          # today's action reminders
 */
import { parseArgs } from "node:util";

import { loadEnv } from "@felina/db/env";

loadEnv();

const { closeDb } = await import("@felina/db");
const { JOB_NAMES, runJob } = await import("./jobs.ts");
type JobName = (typeof JOB_NAMES)[number];

const { positionals } = parseArgs({ allowPositionals: true });
const name = positionals[0] as JobName | undefined;
if (!name || !JOB_NAMES.includes(name)) {
  console.error(`Usage: job <${JOB_NAMES.join("|")}>`);
  process.exit(2);
}

const started = Date.now();
try {
  const result = await runJob(name, {
    triggeredBy: "cli",
    log: (m) => console.log(`[${name}] ${m}`),
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(`[${name}] done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
} catch (error) {
  console.error(`[${name}] failed:`, error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
