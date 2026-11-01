import { describe, expect, it } from "vite-plus/test";

import { PROVINCES, provinceFromPostalCode, provincesForNuts } from "@licita/domain/provinces";

describe("provinces and NUTS codes", () => {
  it("has the 52 Spanish provinces with unique INE codes", () => {
    expect(PROVINCES).toHaveLength(52);
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(52);
  });

  it("maps NUTS-3 codes to a single province", () => {
    expect(provincesForNuts("ES618")).toEqual({ provinces: ["41"], scope: "provincial" });
    expect(provincesForNuts("ES300")).toEqual({ provinces: ["28"], scope: "provincial" });
  });

  it("maps island NUTS-3 codes to their province", () => {
    expect(provincesForNuts("ES709").provinces).toEqual(["38"]); // Tenerife
    expect(provincesForNuts("ES705").provinces).toEqual(["35"]); // Gran Canaria
    expect(provincesForNuts("ES532").provinces).toEqual(["07"]); // Mallorca
  });

  it("expands regional codes and treats ES as national scope", () => {
    expect(provincesForNuts("ES61").provinces).toEqual([
      "04",
      "11",
      "14",
      "18",
      "21",
      "23",
      "29",
      "41",
    ]);
    expect(provincesForNuts("ES70")).toEqual({ provinces: ["35", "38"], scope: "regional" });
    expect(provincesForNuts("ES")).toEqual({ provinces: [], scope: "national" });
    expect(provincesForNuts("FR101").scope).toBe("unknown");
  });

  it("derives the province from a postal code", () => {
    expect(provinceFromPostalCode("09131")).toBe("09");
    expect(provinceFromPostalCode("28003")).toBe("28");
    expect(provinceFromPostalCode("99999")).toBeUndefined();
    expect(provinceFromPostalCode("123")).toBeUndefined();
  });
});
