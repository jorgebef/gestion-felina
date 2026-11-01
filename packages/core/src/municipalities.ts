/** INE municipality catalogue: search for pickers. Public data. */
import { asc, eq, inArray, like, sql } from "drizzle-orm";

import { getDb, municipalities } from "@felina/db";
import { normalizeSearch } from "@felina/domain/municipalities";
import { provinceName } from "@felina/domain/provinces";

export interface MunicipalityOption {
  code: string;
  name: string;
  provinceCode: string;
  provinceName: string;
}

function toOption(row: { code: string; name: string; provinceCode: string }): MunicipalityOption {
  return { ...row, provinceName: provinceName(row.provinceCode) ?? "" };
}

const columns = {
  code: municipalities.code,
  name: municipalities.name,
  provinceCode: municipalities.provinceCode,
};

/** Up to 20 matches; names starting with the term first. */
export async function searchMunicipalities(term: string): Promise<MunicipalityOption[]> {
  const q = normalizeSearch(term);
  if (q.length < 2) return [];
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await getDb()
    .select(columns)
    .from(municipalities)
    .where(like(municipalities.searchName, pattern))
    .orderBy(
      sql`${municipalities.searchName} like ${`${q}%`} desc`,
      sql`length(${municipalities.name})`,
      asc(municipalities.name),
    )
    .limit(20);
  return rows.map(toOption);
}

export async function getMunicipality(code: string): Promise<MunicipalityOption | null> {
  const [row] = await getDb()
    .select(columns)
    .from(municipalities)
    .where(eq(municipalities.code, code));
  return row ? toOption(row) : null;
}

export async function getMunicipalities(codes: string[]): Promise<MunicipalityOption[]> {
  if (!codes.length) return [];
  const rows = await getDb()
    .select(columns)
    .from(municipalities)
    .where(inArray(municipalities.code, codes));
  return rows.map(toOption);
}
