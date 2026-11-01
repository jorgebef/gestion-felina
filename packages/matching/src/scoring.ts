/**
 * Pure scoring function: (profile, tender) → match with explanation, or rejection.
 * No I/O, so it can run in a scheduled job, in tests, or later be combined with a
 * semantic similarity signal.
 */
import { provinceName } from "@licita/domain/provinces";
import { ACTIONABLE_STATUSES, type TenderStatusValue } from "@licita/domain/tenders";
import { keywordMatches, stemSet, tokenize } from "@licita/domain/text";

import { MATCHING_CONFIG, type MatchingConfig } from "./config.ts";

export interface MatchProfile {
  id: string;
  serviceDescription: string;
  cpvCodes: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  provinceCodes: string[];
  nationwide: boolean;
  contractTypes: string[];
  minBudgetEur: number | null;
  maxBudgetEur: number | null;
}

export interface MatchTender {
  id: string;
  title: string;
  description: string | null;
  contractType: string | null;
  status: TenderStatusValue;
  cpvCodes: string[];
  executionProvinces: string[];
  authorityProvinceCode: string | null;
  baseBudgetExVatEur: number | null;
  estimatedValueEur: number | null;
  submissionDeadlineAt: Date | null;
  lots: { code: string; title: string | null; cpvCodes: string[] }[];
}

export type MatchOutcome =
  | { matched: true; score: number; reasons: string[]; matchedLotCodes: string[] }
  | { matched: false; rejection: string };

export interface ScoringContext {
  now: Date;
  cpvLabel?: (code: string) => string | undefined;
  config?: MatchingConfig;
}

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** "45200000" → "452": the meaningful prefix of a CPV code (never shorter than the division). */
export function cpvPrefix(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 8);
  const trimmed = digits.replace(/0+$/, "");
  return trimmed.length < 2 ? digits.slice(0, 2) : trimmed;
}

export function cpvSimilarity(
  profileCode: string,
  tenderCode: string,
  config: MatchingConfig = MATCHING_CONFIG,
): number {
  const p = cpvPrefix(profileCode);
  const t = cpvPrefix(tenderCode);
  const s = config.cpvSimilarity;
  if (t.startsWith(p)) return s.withinProfileCode;
  if (p.startsWith(t)) return s.broaderTenderCode;
  if (p.slice(0, 3) === t.slice(0, 3) && p.length >= 3 && t.length >= 3) return s.sameGroup;
  if (p.slice(0, 2) === t.slice(0, 2)) return s.sameDivision;
  return 0;
}

function bestCpv(profileCodes: string[], tenderCodes: string[], config: MatchingConfig) {
  let best = { similarity: 0, profileCode: "", tenderCode: "" };
  for (const p of profileCodes) {
    for (const t of tenderCodes) {
      const similarity = cpvSimilarity(p, t, config);
      if (similarity > best.similarity) best = { similarity, profileCode: p, tenderCode: t };
    }
  }
  return best;
}

function quoteList(values: string[]): string {
  return values.map((v) => `«${v}»`).join(", ");
}

function withLabel(code: string, label?: (c: string) => string | undefined): string {
  const text = label?.(code);
  return text ? `${code} (${text})` : code;
}

export function scoreTender(
  profile: MatchProfile,
  tender: MatchTender,
  { now, cpvLabel, config = MATCHING_CONFIG }: ScoringContext,
): MatchOutcome {
  // ---- Hard filters ------------------------------------------------------
  if (!ACTIONABLE_STATUSES.includes(tender.status)) {
    return { matched: false, rejection: "La licitación no está abierta" };
  }
  if (tender.submissionDeadlineAt && tender.submissionDeadlineAt < now) {
    return { matched: false, rejection: "El plazo de presentación ha terminado" };
  }
  if (
    profile.contractTypes.length &&
    tender.contractType &&
    !profile.contractTypes.includes(tender.contractType)
  ) {
    return { matched: false, rejection: "Tipo de contrato no seleccionado" };
  }

  const lotText = tender.lots.map((l) => l.title ?? "").join(" ");
  const fullText = `${tender.title} ${tender.description ?? ""} ${lotText}`;
  const textStems = stemSet(fullText);

  const excluded = profile.excludeKeywords.filter((k) => keywordMatches(k, textStems));
  if (excluded.length) {
    return { matched: false, rejection: `Contiene palabras excluidas: ${quoteList(excluded)}` };
  }

  // ---- Location ----------------------------------------------------------
  let location: number;
  let locationReason: string;
  const wantedProvinces = new Set(profile.provinceCodes);
  if (profile.nationwide || !wantedProvinces.size) {
    location = 1;
    locationReason = "Trabaja en toda España";
  } else if (tender.executionProvinces.length) {
    const hits = tender.executionProvinces.filter((p) => wantedProvinces.has(p));
    if (!hits.length) return { matched: false, rejection: "Fuera de sus provincias" };
    location = 1;
    locationReason = `Lugar de ejecución: ${hits.map((p) => provinceName(p) ?? p).join(", ")}`;
  } else if (tender.authorityProvinceCode && wantedProvinces.has(tender.authorityProvinceCode)) {
    location = config.locationFallback.authorityInProfile;
    locationReason = `Lugar de ejecución no detallado; el organismo está en ${provinceName(tender.authorityProvinceCode)}`;
  } else {
    location = config.locationFallback.unspecified;
    locationReason = "Ámbito nacional o lugar de ejecución no especificado";
  }

  // ---- Budget --------------------------------------------------------------
  const budget = tender.baseBudgetExVatEur ?? tender.estimatedValueEur;
  let budgetFit: number;
  let budgetReason: string;
  if (budget == null) {
    budgetFit = config.budgetUnknown;
    budgetReason = "Presupuesto no publicado";
  } else {
    if (profile.minBudgetEur != null && budget < profile.minBudgetEur) {
      return { matched: false, rejection: "Presupuesto inferior a su mínimo" };
    }
    if (profile.maxBudgetEur != null && budget > profile.maxBudgetEur) {
      return { matched: false, rejection: "Presupuesto superior a su máximo" };
    }
    budgetFit = 1;
    budgetReason =
      profile.minBudgetEur != null || profile.maxBudgetEur != null
        ? `Presupuesto ${euro.format(budget)} dentro de su rango`
        : `Presupuesto ${euro.format(budget)}`;
  }

  // ---- Relevance signals --------------------------------------------------
  const weights = config.relevanceWeights;
  const reasons: string[] = [];
  let earned = 0;
  let available = 0;
  let hasSignal = false;

  if (profile.cpvCodes.length) {
    available += weights.cpv;
    const best = bestCpv(profile.cpvCodes, tender.cpvCodes, config);
    if (best.similarity > 0) {
      earned += weights.cpv * best.similarity;
      if (best.similarity >= config.minCpvSignal) hasSignal = true;
      const relation =
        best.similarity === config.cpvSimilarity.withinProfileCode
          ? "dentro de su código"
          : best.similarity === config.cpvSimilarity.broaderTenderCode
            ? "categoría que incluye su código"
            : "misma familia que su código";
      reasons.push(`CPV ${withLabel(best.tenderCode, cpvLabel)}: ${relation} ${best.profileCode}`);
    }
  }

  if (profile.includeKeywords.length) {
    available += weights.keywords;
    const found = profile.includeKeywords.filter((k) => keywordMatches(k, textStems));
    if (found.length) {
      hasSignal = true;
      earned +=
        weights.keywords *
        (config.keywordBase +
          (1 - config.keywordBase) * (found.length / profile.includeKeywords.length));
      reasons.push(`Palabras clave encontradas: ${quoteList(found)}`);
    }
  }

  const descriptionTokens = tokenize(profile.serviceDescription);
  const descriptionStems = new Map(descriptionTokens.map((t) => [t.stem, t.word]));
  if (descriptionStems.size) {
    available += weights.text;
    const shared = [...descriptionStems.entries()].filter(([s]) => textStems.has(s));
    const coverage = Math.min(
      1,
      shared.length / Math.min(descriptionStems.size, config.textCoverageTerms),
    );
    earned += weights.text * coverage;
    if (shared.length >= 2 || (shared.length === 1 && descriptionStems.size <= 2)) hasSignal = true;
    if (shared.length) {
      reasons.push(
        `Términos de su descripción en el anuncio: ${shared.map(([, w]) => w).join(", ")}`,
      );
    }
  }

  if (!hasSignal || !available) {
    return { matched: false, rejection: "Sin coincidencias de actividad" };
  }

  const shares = config.shares;
  const score =
    Math.round(
      (shares.relevance * (earned / available) +
        shares.location * location +
        shares.budget * budgetFit) *
        100,
    ) / 100;
  if (score < config.minScore) {
    return { matched: false, rejection: `Puntuación ${score} por debajo del mínimo` };
  }

  // ---- Lots ------------------------------------------------------------------
  const matchedLotCodes =
    tender.lots.length > 1
      ? tender.lots
          .filter((lot) => {
            const lotStems = stemSet(lot.title ?? "");
            return (
              bestCpv(profile.cpvCodes, lot.cpvCodes, config).similarity >= config.minCpvSignal ||
              profile.includeKeywords.some((k) => keywordMatches(k, lotStems)) ||
              [...descriptionStems.keys()].filter((s) => lotStems.has(s)).length >= 1
            );
          })
          .map((lot) => lot.code)
      : [];
  if (matchedLotCodes.length && matchedLotCodes.length < tender.lots.length) {
    reasons.push(`Lotes más relevantes: ${matchedLotCodes.join(", ")}`);
  }

  reasons.push(locationReason, budgetReason);
  return { matched: true, score: Math.min(100, score), reasons, matchedLotCodes };
}
