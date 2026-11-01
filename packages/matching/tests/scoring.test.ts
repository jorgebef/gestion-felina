import { describe, expect, it } from "vite-plus/test";

import {
  cpvPrefix,
  cpvSimilarity,
  scoreTender,
  type MatchProfile,
  type MatchTender,
} from "@licita/matching/scoring";

const now = new Date("2026-10-22T10:00:00Z");

const profile = (overrides: Partial<MatchProfile> = {}): MatchProfile => ({
  id: "p1",
  serviceDescription: "Limpieza de edificios públicos, oficinas y colegios",
  cpvCodes: ["90910000"],
  includeKeywords: ["limpieza"],
  excludeKeywords: [],
  provinceCodes: ["41"],
  nationwide: false,
  contractTypes: ["services"],
  minBudgetEur: null,
  maxBudgetEur: null,
  ...overrides,
});

const tender = (overrides: Partial<MatchTender> = {}): MatchTender => ({
  id: "t1",
  title: "Servicio de limpieza de colegios públicos municipales",
  description: null,
  contractType: "services",
  status: "open",
  cpvCodes: ["90911200"],
  executionProvinces: ["41"],
  authorityProvinceCode: "41",
  baseBudgetExVatEur: 120_000,
  estimatedValueEur: 240_000,
  submissionDeadlineAt: new Date("2026-11-30T13:00:00Z"),
  lots: [],
  ...overrides,
});

const score = (p: MatchProfile, t: MatchTender) => scoreTender(p, t, { now });

describe("CPV similarity", () => {
  it("uses the significant prefix of a code", () => {
    expect(cpvPrefix("45200000")).toBe("452");
    expect(cpvPrefix("80000000")).toBe("80");
    expect(cpvPrefix("90911200")).toBe("909112");
  });

  it("ranks contained codes over families", () => {
    expect(cpvSimilarity("90910000", "90911200")).toBe(1);
    expect(cpvSimilarity("90911200", "90910000")).toBe(0.7);
    expect(cpvSimilarity("90910000", "90920000")).toBe(0.5);
    expect(cpvSimilarity("90910000", "90500000")).toBe(0.3);
    expect(cpvSimilarity("90910000", "45000000")).toBe(0);
  });
});

describe("scoreTender", () => {
  it("scores a clear match high and explains why", () => {
    const result = score(profile(), tender());
    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reasons.join("\n")).toMatch(/CPV 90911200/);
    expect(result.reasons.join("\n")).toMatch(/«limpieza»/);
    expect(result.reasons).toContain("Lugar de ejecución: Sevilla");
  });

  it("is deterministic", () => {
    expect(score(profile(), tender())).toEqual(score(profile(), tender()));
  });

  it.each([
    ["closed tenders", tender({ status: "awarded" }), "no está abierta"],
    [
      "expired deadlines",
      tender({ submissionDeadlineAt: new Date("2026-10-01T00:00:00Z") }),
      "plazo",
    ],
    ["other contract types", tender({ contractType: "works" }), "Tipo de contrato"],
    ["other provinces", tender({ executionProvinces: ["28"] }), "provincias"],
    ["excluded keywords", tender({ title: "Limpieza viaria y de colegios" }), "excluidas"],
  ])("rejects %s", (_label, t, reason) => {
    const p = profile({ excludeKeywords: ["viaria"] });
    const result = score(p, t);
    expect(result.matched).toBe(false);
    if (!result.matched) expect(result.rejection).toContain(reason);
  });

  it("applies the budget range to the base budget without VAT", () => {
    expect(score(profile({ minBudgetEur: 150_000 }), tender()).matched).toBe(false);
    expect(score(profile({ maxBudgetEur: 100_000 }), tender()).matched).toBe(false);
    expect(score(profile({ minBudgetEur: 100_000, maxBudgetEur: 130_000 }), tender()).matched).toBe(
      true,
    );
  });

  it("does not match on location or budget alone", () => {
    const result = score(
      profile(),
      tender({ title: "Suministro de vehículos eléctricos", cpvCodes: ["34100000"] }),
    );
    expect(result).toEqual({ matched: false, rejection: "Sin coincidencias de actividad" });
  });

  it("needs more than a same-family CPV code", () => {
    const pestControl = tender({ title: "Servicio de control de plagas", cpvCodes: ["90922000"] });
    expect(score(profile({ includeKeywords: [] }), pestControl).matched).toBe(false);
  });

  it("works without CPV codes, from the description alone", () => {
    const result = score(profile({ cpvCodes: [], includeKeywords: [] }), tender());
    expect(result.matched).toBe(true);
  });

  it("gives partial location credit when the place is not published", () => {
    const result = score(
      profile(),
      tender({ executionProvinces: [], authorityProvinceCode: "41" }),
    );
    expect(
      result.matched && result.reasons.some((r) => r.includes("organismo está en Sevilla")),
    ).toBe(true);
    const national = score(
      profile(),
      tender({ executionProvinces: [], authorityProvinceCode: "28" }),
    );
    expect(national.matched && national.reasons).toContain(
      "Ámbito nacional o lugar de ejecución no especificado",
    );
  });

  it("flags the relevant lots", () => {
    const result = score(
      profile({ includeKeywords: [] }),
      tender({
        title: "Servicios para centros municipales",
        cpvCodes: ["90911200", "55320000"],
        lots: [
          { code: "1", title: "Limpieza de colegios", cpvCodes: ["90911200"] },
          { code: "2", title: "Comedor escolar", cpvCodes: ["55320000"] },
        ],
      }),
    );
    expect(result.matched && result.matchedLotCodes).toEqual(["1"]);
  });
});
