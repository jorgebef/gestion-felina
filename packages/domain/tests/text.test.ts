import { describe, expect, it } from "vite-plus/test";

import {
  keywordMatches,
  normalizeText,
  parseKeywordList,
  stem,
  stemSet,
  tokenize,
} from "@licita/domain/text";

describe("Spanish text normalisation", () => {
  it("strips accents and punctuation", () => {
    expect(normalizeText("Construcción, ¡Rehabilitación!")).toBe("construccion rehabilitacion");
  });

  it("reduces related word forms to the same stem", () => {
    expect(stem("limpieza")).toBe(stem("limpiezas"));
    expect(stem("edificio")).toBe(stem("edificios"));
    expect(stem("mantenimiento")).toBe(stem("mantenimientos"));
  });

  it("drops stop words and generic tender words", () => {
    const words = tokenize("Servicio de limpieza de los colegios del municipio").map((t) => t.word);
    expect(words).toEqual(["limpieza", "colegios", "municipio"]);
  });

  it("matches multi-word keywords only when every word is present", () => {
    const text = stemSet("Mantenimiento del alumbrado público de la ciudad");
    expect(keywordMatches("alumbrado público", text)).toBe(true);
    expect(keywordMatches("alumbrado navideño", text)).toBe(false);
    expect(keywordMatches("de la", text)).toBe(false);
  });

  it("parses comma/semicolon/newline separated keyword lists", () => {
    expect(parseKeywordList("limpieza,  poda ; jardinería\nlimpieza")).toEqual([
      "limpieza",
      "poda",
      "jardinería",
    ]);
  });
});

describe("stem edge cases", () => {
  it("handles -ción plurals and keeps short words intact", () => {
    expect(stem("acciones")).toBe(stem("acción".normalize("NFD").replace(/\p{Diacritic}/gu, "")));
    expect(stem("colegios")).toBe(stem("colegio"));
    expect(stem("gas")).toBe("gas");
  });
});
