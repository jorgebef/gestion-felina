/** Worker configuration, validated once on first use. */
import { z } from "zod";

const cron = (fallback: string) =>
  z
    .string()
    .trim()
    .default(fallback)
    .transform((v) => v || fallback);

const schema = z.object({
  PLACSP_FEED_URL: z
    .url()
    .default(
      "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom",
    ),
  /** Upper bound of feed pages walked per incremental import (~450 entries each). */
  IMPORT_MAX_PAGES: z.coerce.number().int().min(1).max(500).default(20),
  /** Time zone of the schedules below. */
  SCHEDULE_TIMEZONE: z.string().default("Europe/Madrid"),
  /** Import + match + instant alerts. PLACSP republishes the feed every few minutes. */
  SCHEDULE_SYNC: cron("*/30 * * * *"),
  SCHEDULE_DAILY: cron("0 7 * * *"),
  SCHEDULE_WEEKLY: cron("0 7 * * 1"),
  /** Full re-match, catches profile or scoring changes the incremental runs missed. */
  SCHEDULE_REMATCH: cron("30 3 * * *"),
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
