import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";

import { getDb, importRunPages, tenders } from "@licita/db";
import { runImport } from "@licita/procurement/pipeline";

import { describeDb, documentsConnector, FIXTURE, memoryArchive, resetData } from "./helpers.ts";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describeDb("raw page archive", () => {
  beforeEach(resetData);

  it("stores each fetched page and records its provenance", async () => {
    const { archive, objects } = memoryArchive();
    const summary = await runImport(documentsConnector([FIXTURE]), { maxPages: 5, archive });
    expect(summary.status).toBe("succeeded");

    const pages = await getDb()
      .select()
      .from(importRunPages)
      .where(eq(importRunPages.importRunId, summary.runId));
    expect(pages).toHaveLength(1);
    const [page] = pages;
    expect(page!.storageKey).toMatch(
      new RegExp(`^raw/placsp_direct/\\d{4}/\\d{2}/\\d{2}/${summary.runId}/0001\\.atom$`),
    );
    expect(page).toMatchObject({
      pageNumber: 1,
      sourceUrl: "fixture://page-1",
      contentSha256: sha256(FIXTURE),
      byteSize: Buffer.byteLength(FIXTURE),
    });
    expect(objects.get(page!.storageKey!)).toEqual({
      body: FIXTURE,
      contentType: "application/atom+xml",
    });
  });

  it("records page hashes without storage when no archive is configured", async () => {
    const summary = await runImport(documentsConnector([FIXTURE]), { maxPages: 5 });
    const [page] = await getDb()
      .select()
      .from(importRunPages)
      .where(eq(importRunPages.importRunId, summary.runId));
    expect(page).toMatchObject({ storageKey: null, contentSha256: sha256(FIXTURE) });
  });

  it("keeps importing when storage fails, and reports it", async () => {
    const { archive } = memoryArchive({ fail: true });
    const summary = await runImport(documentsConnector([FIXTURE]), { maxPages: 5, archive });
    expect(summary).toMatchObject({ status: "partial", created: 2, errorsCount: 1 });
    expect((await getDb().select({ id: tenders.id }).from(tenders)).length).toBe(2);
    const [page] = await getDb()
      .select()
      .from(importRunPages)
      .where(eq(importRunPages.importRunId, summary.runId));
    expect(page).toMatchObject({ storageKey: null, contentSha256: sha256(FIXTURE) });
  });
});
