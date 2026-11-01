import { describe, expect, it } from "vite-plus/test";

import { alertProfileInputSchema } from "@licita/schemas/alert-profile";
import { tenderSearchSchema } from "@licita/schemas/tender-search";

const valid = {
  name: "Limpieza",
  serviceDescription: "Limpieza de oficinas y colegios",
  sectors: ["limpieza"],
  cpvCodes: ["90910000", "90910000"],
  includeKeywords: ["limpieza"],
  excludeKeywords: [],
  provinceCodes: ["41", "28"],
  nationwide: false,
  contractTypes: ["services"],
  minBudgetEur: 1000,
  maxBudgetEur: null,
  emailFrequency: "daily",
  isActive: true,
};

describe("alert profile validation", () => {
  it("accepts and normalises a valid profile", () => {
    const parsed = alertProfileInputSchema.parse(valid);
    expect(parsed.cpvCodes).toEqual(["90910000"]);
    expect(parsed.provinceCodes).toEqual(["28", "41"]);
  });

  it("requires a territory", () => {
    expect(alertProfileInputSchema.safeParse({ ...valid, provinceCodes: [] }).success).toBe(false);
    expect(
      alertProfileInputSchema.parse({ ...valid, provinceCodes: ["41"], nationwide: true })
        .provinceCodes,
    ).toEqual([]);
  });

  it("rejects invalid codes and budget order", () => {
    expect(alertProfileInputSchema.safeParse({ ...valid, cpvCodes: ["123"] }).success).toBe(false);
    expect(alertProfileInputSchema.safeParse({ ...valid, provinceCodes: ["99"] }).success).toBe(
      false,
    );
    expect(alertProfileInputSchema.safeParse({ ...valid, sectors: ["nope"] }).success).toBe(false);
    expect(
      alertProfileInputSchema.safeParse({ ...valid, minBudgetEur: 10, maxBudgetEur: 5 }).success,
    ).toBe(false);
  });
});

describe("tender search params", () => {
  it("drops invalid values instead of failing", () => {
    expect(
      tenderSearchSchema.parse({ province: "99", cpv: "abc", page: "-2", type: "works" }),
    ).toEqual({ type: "works" });
  });
});
