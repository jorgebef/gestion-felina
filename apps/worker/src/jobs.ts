/**
 * Background jobs. Each one is safe to run repeatedly and concurrently with the API.
 * The worker process runs them on a schedule (./index.ts); ./cli.ts runs one on demand,
 * which also suits external schedulers (cron, Kubernetes CronJob, GitHub Actions…).
 *
 *   reminders   email each participant the actions scheduled for today
 */
import { runActionReminders } from "@felina/notifications/reminders";

export const JOB_NAMES = ["reminders"] as const;
export type JobName = (typeof JOB_NAMES)[number];

export interface JobOptions {
  triggeredBy?: string;
  log?: (message: string) => void;
}

export async function runJob(name: JobName, options: JobOptions = {}): Promise<unknown> {
  const log = options.log ?? (() => {});
  switch (name) {
    case "reminders": {
      const summary = await runActionReminders();
      log(`${summary.sent} enviados, ${summary.failed} con error, ${summary.skipped} ya enviados`);
      return { reminders: summary };
    }
  }
}
