import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { externalIdFromEntryId, parseFeed } from "@licita/procurement/placsp/parser";

const FEED = readFileSync(new URL("fixtures/placsp/feed-page-1.atom", import.meta.url), "utf8");

describe("PLACSP feed parser (real feed excerpt)", () => {
  const parsed = parseFeed(FEED);
  const simple = parsed.records.find((r) => r.externalRecordId === "20757267")!;
  const withLots = parsed.records.find((r) => r.externalRecordId === "15812834")!;

  it("parses every entry without errors and finds the next page", () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.nextUrl).toMatch(/licitacionesPerfilesContratanteCompleto3_\d{8}_\d{6}\.atom$/);
  });

  it("uses the numeric entry id as stable external id", () => {
    expect(
      externalIdFromEntryId(
        "https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/20757267",
      ),
    ).toBe("20757267");
  });

  it("normalises the file (expediente) fields", () => {
    expect(simple).toMatchObject({
      sourcePlatform: "placsp_direct",
      expedienteNumber: "91/2026",
      title: "Estacion Depuradora de Aguas Residuales en San Pedro Samuel",
      contractType: "works",
      procedureType: "simplified_open",
      status: "open",
      mainCpvCode: "45200000",
      baseBudgetExVatEur: 72839.23,
      estimatedValueEur: 72839.23,
      executionScope: "national",
    });
    expect(simple.officialUrl).toContain("deeplink:detalle_licitacion");
    // EndDate 2026-11-11 + EndTime 14:00 in Spain = 13:00 UTC.
    expect(simple.submissionDeadlineAt?.toISOString()).toBe("2026-11-11T13:00:00.000Z");
    expect(simple.summary.totalAmountWithVatEur).toBe(88135.47);
  });

  it("keeps base budget and estimated value apart", () => {
    expect(withLots.baseBudgetExVatEur).toBe(391321);
    expect(withLots.estimatedValueEur).toBe(1237300.52);
  });

  it("extracts the contracting authority with its platform id", () => {
    expect(simple.authority).toMatchObject({
      platformId: "30027450004125",
      taxId: "P0926700F",
      dir3: "L01092595",
      provinceCode: "09",
      administrationType: "Autoridad local",
    });
  });

  it("extracts lots with their own budget, CPV and place", () => {
    expect(withLots.lots.map((l) => l.sourceLotCode)).toEqual(["1", "2"]);
    expect(withLots.lots[0]).toMatchObject({
      cpvCodes: ["30195000"],
      executionProvinces: ["28"],
      baseBudgetExVatEur: 60371,
    });
    expect(withLots.status).toBe("formalized");
  });

  it("turns each publication into a notice with a stable id", () => {
    const ids = withLots.notices.map((n) => n.externalNoticeId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("DOC_CAN_ADJ|Perfil del contratante|2024-11-25");
    expect(withLots.notices.find((n) => n.eventType === "award")).toBeTruthy();
    // Re-parsing yields the same ids (idempotent events).
    expect(
      parseFeed(FEED)
        .records.find((r) => r.externalRecordId === "15812834")!
        .notices.map((n) => n.externalNoticeId),
    ).toEqual(ids);
  });

  it("reads award results", () => {
    const results = withLots.summary.results as { lot: string; result: string; winner?: string }[];
    expect(results[0]).toMatchObject({
      lot: "1",
      result: "Adjudicado",
      winner: "RESINAS OLOT, S.L.",
    });
    expect(results[1]).toMatchObject({ lot: "2", result: "Desierto" });
  });

  it("reads tombstones as deletions", () => {
    expect(parsed.deletions).toEqual([
      expect.objectContaining({ externalRecordId: "20757350", reason: "ANULADA" }),
    ]);
  });

  it("reports a malformed entry without failing the page", () => {
    const broken = FEED.replace(
      "<cac-place-ext:ContractFolderStatus>",
      "<cac-place-ext:Other>",
    ).replace("</cac-place-ext:ContractFolderStatus>", "</cac-place-ext:Other>");
    const result = parseFeed(broken);
    expect(result.records).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ message: "Entry without ContractFolderStatus" }),
    ]);
  });
});
