/**
 * Worker process: runs the background jobs on their schedules (SCHEDULE_* variables).
 * A job never overlaps itself in this process, and deliveries are deduplicated in the
 * database, so running several workers by mistake does not send duplicates.
 *
 *   vp run --filter @felina/worker dev     # development (watch)
 *   node dist/index.mjs                    # production
 */
import { loadEnv } from "@felina/db/env";

loadEnv();

const { Cron } = await import("croner");
const { closeDb } = await import("@felina/db");
const { workerEnv } = await import("./env.ts");
const { runJob } = await import("./jobs.ts");

type ScheduledJob = "reminders";

const env = workerEnv();
const schedules: Record<ScheduledJob, string> = {
  reminders: env.SCHEDULE_REMINDERS,
};

const running = new Set<Promise<unknown>>();

async function execute(name: ScheduledJob) {
  const started = Date.now();
  console.log(`[worker] ${name} started`);
  try {
    const result = await runJob(name, {
      triggeredBy: "worker",
      log: (m) => console.log(`[${name}] ${m}`),
    });
    console.log(
      `[worker] ${name} done in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      JSON.stringify(result),
    );
  } catch (error) {
    console.error(`[worker] ${name} failed`, error);
  }
}

const jobs = Object.entries(schedules).map(
  ([name, pattern]) =>
    new Cron(pattern, { name, timezone: env.SCHEDULE_TIMEZONE, protect: true }, () => {
      const run = execute(name as ScheduledJob);
      running.add(run);
      return run.finally(() => running.delete(run));
    }),
);

for (const job of jobs) {
  console.log(`[worker] ${job.name}: "${job.getPattern()}" → next ${job.nextRun()?.toISOString()}`);
}

async function shutdown(signal: string) {
  console.log(`[worker] ${signal}: waiting for ${running.size} running job(s)`);
  jobs.forEach((job) => job.stop());
  setTimeout(() => process.exit(1), 60_000).unref();
  await Promise.allSettled(running);
  await closeDb();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
