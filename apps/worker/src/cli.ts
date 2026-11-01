/**
 * Runs one job and exits (manual runs, or an external scheduler instead of ./index.ts).
 *
 *   vp run job sync               # import + match + instant alerts
 *   vp run job import --pages 5 --full
 *   vp run job rematch
 *   vp run job daily              # daily digest emails
 */
import { parseArgs } from "node:util";

import { loadEnv } from "@licita/db/env";

loadEnv();

const { closeDb } = await import("@licita/db");
const { JOB_NAMES, runJob } = await import("./jobs.ts");
type JobName = (typeof JOB_NAMES)[number];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { pages: { type: "string" }, full: { type: "boolean", default: false } },
});
const name = positionals[0] as JobName | undefined;
if (!name || !JOB_NAMES.includes(name)) {
  console.error(`Usage: job <${JOB_NAMES.join("|")}> [--pages N] [--full]`);
  process.exit(2);
}

const started = Date.now();
try {
  const result = await runJob(name, {
    triggeredBy: "cli",
    maxPages: values.pages ? Number(values.pages) : undefined,
    full: values.full,
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
