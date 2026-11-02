/**
 * Change proposals edited by town halls: the editable draft of a colony or cat, and the
 * fields that differ from the current values (the only ones sent). Shared by the web and
 * mobile "propose a change" forms.
 */
import {
  CAT_PROPOSABLE_FIELDS,
  COLONY_PROPOSABLE_FIELDS,
  type CatSex,
} from "@felina/domain/felina";

import type { MunicipalityValue } from "./location.ts";

/** Label of every proposable field (colonies and cats). */
export const PROPOSAL_FIELD_LABELS: Record<string, string> = {
  ...COLONY_PROPOSABLE_FIELDS,
  ...CAT_PROPOSABLE_FIELDS,
};

export interface ProposalTargetValues {
  name: string | null;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  municipalityCode: string;
  municipalityName: string;
}

export type ProposalTarget =
  | { type: "colony"; id: string; current: ProposalTargetValues & { name: string } }
  | {
      type: "cat";
      id: string;
      current: ProposalTargetValues & {
        sex: CatSex;
        birthDate: string | null;
        birthDateApproximate: boolean;
        sterilized: boolean;
      };
    };

export type Draft = Record<string, unknown>;

/** Text value of a draft field (strings and numbers; anything else is empty). */
export function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function initialDraft(target: ProposalTarget): Draft {
  const c = target.current;
  return {
    name: c.name ?? "",
    description: c.description ?? "",
    address: c.address ?? "",
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    municipality: { code: c.municipalityCode, name: c.municipalityName } as MunicipalityValue,
    ...(target.type === "cat"
      ? {
          sex: target.current.sex,
          birthDate: target.current.birthDate ?? "",
          birthDateApproximate: target.current.birthDateApproximate,
          sterilized: target.current.sterilized,
        }
      : {}),
  };
}

/** Only fields that differ from the current values are sent. */
export function changesFrom(target: ProposalTarget, draft: Draft): Record<string, unknown> {
  const c = target.current as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const text = (key: string) => {
    const value = str(draft[key]).trim();
    const normalized = value || null;
    if (normalized !== (c[key] ?? null)) out[key] = normalized;
  };
  text("name");
  text("description");
  text("address");
  // Decimal comma accepted (Spanish keyboards).
  const lat = Number(str(draft.latitude).replace(",", "."));
  const lng = Number(str(draft.longitude).replace(",", "."));
  if (lat !== c.latitude || lng !== c.longitude) {
    out.latitude = lat;
    out.longitude = lng;
  }
  const municipality = draft.municipality as MunicipalityValue | null;
  if (municipality && municipality.code !== c.municipalityCode)
    out.municipalityCode = municipality.code;
  if (target.type === "cat") {
    if (draft.sex !== c.sex) out.sex = draft.sex;
    const birthDate = str(draft.birthDate) || null;
    if (birthDate !== (c.birthDate ?? null)) out.birthDate = birthDate;
    if (draft.birthDateApproximate !== c.birthDateApproximate) {
      out.birthDateApproximate = draft.birthDateApproximate;
    }
    if (draft.sterilized !== c.sterilized) out.sterilized = draft.sterilized;
  }
  return out;
}
