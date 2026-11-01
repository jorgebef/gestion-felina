import { describe, expect, it } from "vite-plus/test";

import { isInSpain } from "@felina/domain/felina";
import {
  municipalityDisplayName,
  municipalityLabel,
  normalizeSearch,
} from "@felina/domain/municipalities";
import { PROVINCES } from "@felina/domain/provinces";

describe("municipalities", () => {
  it("moves the INE trailing article to the front", () => {
    expect(municipalityDisplayName("Coruña, A")).toBe("A Coruña");
    expect(municipalityDisplayName("Rozas de Madrid, Las")).toBe("Las Rozas de Madrid");
    expect(municipalityDisplayName("Orxa, l'/Lorcha")).toBe("L'Orxa/Lorcha");
    expect(municipalityDisplayName("Vila Joiosa, la/Villajoyosa")).toBe(
      "La Vila Joiosa/Villajoyosa",
    );
    expect(municipalityDisplayName("Sevilla")).toBe("Sevilla");
  });

  it("does not treat inner commas as articles", () => {
    expect(municipalityDisplayName("Castell-Platja d'Aro, Platja d'Aro i s'Agaró")).toBe(
      "Castell-Platja d'Aro, Platja d'Aro i s'Agaró",
    );
  });

  it("labels a municipality with its province", () => {
    expect(municipalityLabel({ code: "28127", name: "Las Rozas de Madrid" })).toBe(
      "Las Rozas de Madrid (Madrid)",
    );
  });

  it("normalises search text", () => {
    expect(normalizeSearch("  Ávila ")).toBe("avila");
  });

  it("has the 52 provinces", () => {
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(52);
  });

  it("checks coordinates are in Spain", () => {
    expect(isInSpain(40.4168, -3.7038)).toBe(true); // Madrid
    expect(isInSpain(28.1235, -15.4363)).toBe(true); // Las Palmas
    expect(isInSpain(48.8566, 2.3522)).toBe(false); // París
  });
});

describe("Madrid day bounds", () => {
  it("handles winter and summer time", async () => {
    const { madridDayBounds } = await import("@felina/domain/time");
    expect(madridDayBounds(new Date("2026-01-15T12:00:00Z"))).toEqual({
      key: "2026-01-15",
      start: new Date("2026-01-14T23:00:00Z"),
      end: new Date("2026-01-15T23:00:00Z"),
    });
    expect(madridDayBounds(new Date("2026-07-15T23:30:00Z")).key).toBe("2026-07-16");
    expect(madridDayBounds(new Date("2026-07-15T12:00:00Z")).start).toEqual(
      new Date("2026-07-14T22:00:00Z"),
    );
  });
});
