import { getLocale } from "#/paraglide/runtime";

const INTL_LOCALES = { en: "en-GB", es: "es-ES" } as const;

export function intlLocale(): string {
  return INTL_LOCALES[getLocale()];
}

export function formatCurrency(
  value: number,
  options: { compact?: boolean; decimals?: number; signed?: boolean } = {},
): string {
  const { compact = false, decimals = 0, signed = false } = options;
  return new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency: "EUR",
    notation: compact ? "compact" : "standard",
    ...(compact
      ? { maximumSignificantDigits: 3 }
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value + 0); // `+ 0` turns -0 into 0 so it never renders as "-€0"
}

/**
 * Splits a currency string around its decimals so they can be dimmed:
 * `€12,680.42` → `€12,680` + `.42`, and `12.680,42 €` → `12.680` + `,42` + ` €`.
 */
export function splitCurrency(value: number): { whole: string; fraction: string; suffix: string } {
  const parts = new Intl.NumberFormat(intlLocale(), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(value);
  let whole = "";
  let fraction = "";
  let suffix = "";
  let stage: "whole" | "fraction" | "suffix" = "whole";
  for (const part of parts) {
    if (part.type === "decimal") stage = "fraction";
    else if (stage === "fraction" && part.type !== "fraction") stage = "suffix";
    if (stage === "whole") whole += part.value;
    else if (stage === "fraction") fraction += part.value;
    else suffix += part.value;
  }
  return { whole, fraction, suffix };
}

export function formatPercent(
  value: number,
  options: { decimals?: number; signed?: boolean } = {},
): string {
  const { decimals = 1, signed = false } = options;
  return new Intl.NumberFormat(intlLocale(), {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value);
}

export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Formats a `YYYY-MM` month key. */
export function formatMonth(key: string, style: "short" | "medium" | "long" = "short"): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(), {
    month: style === "long" ? "long" : "short",
    year: style === "short" ? "2-digit" : "numeric",
  }).format(new Date(year, month - 1, 1));
}

/** Formats a `YYYY-MM-DD` date string. */
export function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
