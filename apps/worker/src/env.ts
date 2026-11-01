/** Worker configuration, validated once on first use. */
import { z } from "zod";

const cron = (fallback: string) =>
  z
    .string()
    .trim()
    .default(fallback)
    .transform((v) => v || fallback);

const schema = z.object({
  /** Time zone of the schedules below. */
  SCHEDULE_TIMEZONE: z.string().default("Europe/Madrid"),
  /** Morning email to every participant with the day's actions. */
  SCHEDULE_REMINDERS: cron("0 7 * * *"),
});

export type WorkerEnv = z.infer<typeof schema>;

let cached: WorkerEnv | undefined;

export function workerEnv(): WorkerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid worker environment: ${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
