import { asc, inArray, like, or, sql } from "drizzle-orm";

import { type Database, cpvCodes, type TenantTx } from "@licita/db";
import { sectorById } from "@licita/domain/sectors";
import { tokenize } from "@licita/domain/text";

type Reader = Database | TenantTx;

export interface CpvOption {
  code: string;
  label: string;
}

export interface CpvSuggestion extends CpvOption {
  reason: string;
}

export async function cpvLabels(db: Reader, codes: string[]): Promise<CpvOption[]> {
  if (!codes.length) return [];
  const rows = await db
    .select({ code: cpvCodes.code, label: cpvCodes.labelEs })
    .from(cpvCodes)
    .where(inArray(cpvCodes.code, codes));
  const byCode = new Map(rows.map((r) => [r.code, r.label]));
  return codes.map((code) => ({ code, label: byCode.get(code) ?? "Código no encontrado" }));
}

/** Manual picker: by code prefix ("4521") or by words of the official label. */
export async function searchCpv(db: Reader, query: string, limit = 20): Promise<CpvOption[]> {
  const q = query.trim();
  if (/^\d{2,8}$/.test(q)) {
    return db
      .select({ code: cpvCodes.code, label: cpvCodes.labelEs })
      .from(cpvCodes)
      .where(like(cpvCodes.code, `${q}%`))
      .orderBy(asc(cpvCodes.code))
      .limit(limit);
  }
  const words = tokenize(q).map((t) => t.word);
  if (!words.length) return [];
  // Prefix match on each word (AND), accent-insensitive.
  const tsQuery = words.map((w) => `${w}:*`).join(" & ");
  return db
    .select({ code: cpvCodes.code, label: cpvCodes.labelEs })
    .from(cpvCodes)
    .where(
      or(
        sql`${cpvCodes.searchDocument} @@ to_tsquery('spanish', ${tsQuery})`,
        sql`app_unaccent(lower(${cpvCodes.labelEs})) like ${`%${words.join(" ")}%`}`,
      ),
    )
    .orderBy(sql`length(rtrim(${cpvCodes.code}, '0'))`, asc(cpvCodes.code))
    .limit(limit);
}

/**
 * Suggestions for a natural-language description: the CPV codes of the chosen sectors
 * plus catalogue entries whose label shares words with the description. They are
 * proposals for the user to accept or discard, never applied automatically.
 */
export async function suggestCpv(
  db: Reader,
  { description, sectors, exclude }: { description: string; sectors: string[]; exclude: string[] },
): Promise<CpvSuggestion[]> {
  const skip = new Set(exclude);
  const suggestions: CpvSuggestion[] = [];

  const sectorCodes = new Map<string, string>();
  for (const id of sectors) {
    const sector = sectorById(id);
    sector?.cpvCodes.forEach((code) => {
      if (!skip.has(code) && !sectorCodes.has(code)) sectorCodes.set(code, sector.label);
    });
  }
  for (const option of await cpvLabels(db, [...sectorCodes.keys()])) {
    suggestions.push({ ...option, reason: `Sector: ${sectorCodes.get(option.code)}` });
    skip.add(option.code);
  }

  const words = [...new Set(tokenize(description).map((t) => t.word))].slice(0, 12);
  if (words.length) {
    const tsQuery = words.join(" | ");
    const rows = await db
      .select({
        code: cpvCodes.code,
        label: cpvCodes.labelEs,
        rank: sql<number>`ts_rank(${cpvCodes.searchDocument}, to_tsquery('spanish', ${tsQuery}))`,
      })
      .from(cpvCodes)
      .where(sql`${cpvCodes.searchDocument} @@ to_tsquery('spanish', ${tsQuery})`)
      .orderBy(
        sql`ts_rank(${cpvCodes.searchDocument}, to_tsquery('spanish', ${tsQuery})) desc`,
        // Prefer broader categories (more trailing zeros) on ties.
        sql`length(rtrim(${cpvCodes.code}, '0'))`,
      )
      .limit(30);
    for (const row of rows) {
      if (skip.has(row.code)) continue;
      suggestions.push({ code: row.code, label: row.label, reason: "Coincide con su descripción" });
      skip.add(row.code);
      if (suggestions.length >= sectorCodes.size + 8) break;
    }
  }
  return suggestions;
}
