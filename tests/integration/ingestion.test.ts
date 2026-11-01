import { eq, sql } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";

import { getDb, importRuns, tenderEvents, tenders } from "@licita/db";
import { runImport } from "@licita/procurement/pipeline";
import type { SourceConnector } from "@licita/procurement/types";

import { describeDb, documentsConnector, FIXTURE, resetData } from "./helpers.ts";

const count = async (table: string) =>
  Number(
    (await getDb().execute<{ n: string }>(sql.raw(`select count(*) n from ${table}`))).rows[0]!.n,
  );

/**
 * Test-only variant of the real excerpt: the same file republished later with a new
 * deadline and status, as PLACSP does when a notice changes it.
 */
const REPUBLISHED = FIXTURE.replace(
  "<updated>2026-10-22T20:01:47.457+02:00</updated>",
  "<updated>2026-10-23T09:00:00.000+02:00</updated>",
)
  .replace("<cbc:EndDate>2026-11-11</cbc:EndDate>", "<cbc:EndDate>2026-11-18</cbc:EndDate>")
  .replace(
    'SyndicationContractFolderStatusCode-2.04.gc">PUB<',
    'SyndicationContractFolderStatusCode-2.04.gc">EV<',
  );

describeDb("PLACSP import pipeline", () => {
  beforeEach(resetData);

  it("creates tenders, sources, lots and events from the feed", async () => {
    const summary = await runImport(documentsConnector([FIXTURE]), { maxPages: 5 });
    expect(summary).toMatchObject({ status: "succeeded", created: 2, updated: 0, errorsCount: 0 });
    expect(await count("tenders")).toBe(2);
    expect(await count("tender_sources")).toBe(2);
    expect(await count("tender_lots")).toBe(2);
    expect(await count("contracting_authorities")).toBe(2);
    expect(summary.eventsCreated).toBe(await count("tender_events"));
  });

  it("is idempotent: re-importing the same records duplicates nothing", async () => {
    await runImport(documentsConnector([FIXTURE]), { maxPages: 5 });
    const events = await count("tender_events");
    const again = await runImport(documentsConnector([FIXTURE]), { maxPages: 5, full: true });
    expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 2, eventsCreated: 0 });
    expect(await count("tenders")).toBe(2);
    expect(await count("tender_events")).toBe(events);
  });

  it("updates the same tender when the source republishes it and records the changes", async () => {
    await runImport(documentsConnector([FIXTURE]), { maxPages: 5 });
    const summary = await runImport(documentsConnector([REPUBLISHED]), { maxPages: 5, full: true });
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
    expect(await count("tenders")).toBe(2);

    const [tender] = await getDb()
      .select()
      .from(tenders)
      .where(eq(tenders.expedienteNumber, "91/2026"));
    expect(tender!.status).toBe("closed");
    expect(tender!.submissionDeadlineAt?.toISOString()).toBe("2026-11-18T13:00:00.000Z");
    const events = await getDb()
      .select()
      .from(tenderEvents)
      .where(eq(tenderEvents.tenderId, tender!.id));
    expect(events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(["status_change", "change_detected"]),
    );
    const change = events.find((e) => e.eventType === "change_detected")!;
    expect(Object.keys(change.payload.changes as object)).toEqual(["submissionDeadlineAt"]);

    // An older copy arriving afterwards is ignored.
    const stale = await runImport(documentsConnector([FIXTURE]), { maxPages: 5, full: true });
    expect(stale).toMatchObject({ updated: 0, unchanged: 2 });
  });

  it("marks a tender cancelled when the source publishes a tombstone for it", async () => {
    await runImport(documentsConnector([FIXTURE]), { maxPages: 5 });
    const tombstone = FIXTURE.replace(
      'ref="https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/20757350"',
      'ref="https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/20757267"',
    );
    await runImport(documentsConnector([tombstone]), { maxPages: 5, full: true });
    const [tender] = await getDb()
      .select()
      .from(tenders)
      .where(eq(tenders.expedienteNumber, "91/2026"));
    expect(tender!.status).toBe("cancelled");
  });

  it("logs bad records and source failures without aborting, and audits the run", async () => {
    const broken = FIXTURE.replace(
      "<cac-place-ext:ContractFolderStatus>",
      "<cac-place-ext:Other>",
    ).replace("</cac-place-ext:ContractFolderStatus>", "</cac-place-ext:Other>");
    const failing: SourceConnector = {
      ...documentsConnector([broken]),
      async *pages(options) {
        yield* documentsConnector([broken]).pages(options);
        throw new Error("HTTP 503 fetching page 2");
      },
    };
    const summary = await runImport(failing, { maxPages: 5 });
    expect(summary.status).toBe("partial");
    expect(summary.created).toBe(1);
    expect(summary.errorsCount).toBe(2);
    const [run] = await getDb().select().from(importRuns).where(eq(importRuns.id, summary.runId));
    expect(run!.finishedAt).not.toBeNull();
    expect(run!.errors).toEqual([
      expect.objectContaining({ externalRecordId: "20757267" }),
      expect.objectContaining({ message: expect.stringContaining("HTTP 503") }),
    ]);
    // A failed run does not advance the high-water mark.
    expect(run!.highWaterMark).toBeNull();
  });

  it("refuses to start while another run is in progress", async () => {
    await getDb().insert(importRuns).values({ connector: "placsp_direct", sourceUrl: "x" });
    await expect(runImport(documentsConnector([FIXTURE]), { maxPages: 1 })).rejects.toThrow(
      /en curso/,
    );
  });
});
