/**
 * Background jobs. Each one is safe to run repeatedly and concurrently with the API.
 * The worker process runs them on a schedule (./index.ts); ./cli.ts runs one on demand,
 * which also suits external schedulers (cron, Kubernetes CronJob, GitHub Actions…).
 *
 *   sync    import PLACSP changes → match changed tenders → send "instant" alerts
 *   daily   daily digests
 *   weekly  weekly digests
 *   rematch full matching of every active profile against every open tender
 */
import { runMatching } from "@licita/matching/engine";
import { runDigest } from "@licita/notifications/service";
import { placspConnector } from "@licita/procurement/placsp/connector";
import { runImport } from "@licita/procurement/pipeline";
import type { RawArchive } from "@licita/procurement/types";
import { storageFromEnv } from "@licita/storage";

import { workerEnv } from "./env.ts";

export const JOB_NAMES = ["sync", "import", "rematch", "daily", "weekly", "instant"] as const;
export type JobName = (typeof JOB_NAMES)[number];

let archive: RawArchive | null | undefined;

/** Raw-page archive in object storage (gzip-compressed), when S3_BUCKET is configured. */
function rawArchive(): RawArchive | undefined {
  if (archive === undefined) {
    const storage = storageFromEnv();
    archive = storage && { put: (object) => storage.put({ ...object, compress: true }) };
  }
  return archive ?? undefined;
}

export interface JobOptions {
  triggeredBy?: string;
  maxPages?: number;
  full?: boolean;
  log?: (message: string) => void;
}

export async function runJob(name: JobName, options: JobOptions = {}): Promise<unknown> {
  const log = options.log ?? (() => {});
  switch (name) {
    case "import":
    case "sync": {
      const env = workerEnv();
      const imported = await runImport(placspConnector({ feedUrl: env.PLACSP_FEED_URL }), {
        maxPages: options.maxPages ?? env.IMPORT_MAX_PAGES,
        full: options.full,
        triggeredBy: options.triggeredBy,
        archive: rawArchive(),
        log,
      });
      const { changedTenderIds, ...importSummary } = imported;
      if (name === "import") return { import: importSummary };
      const matching = changedTenderIds.length
        ? await runMatching({ tenderIds: changedTenderIds })
        : null;
      const instant = await runDigest("instant");
      return { import: importSummary, matching, instant };
    }
    case "rematch":
      return { matching: await runMatching() };
    case "daily":
    case "weekly":
    case "instant":
      return { notifications: await runDigest(name) };
  }
}
