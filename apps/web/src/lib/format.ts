const LOCALE = "es-ES";
const TIME_ZONE = "Europe/Madrid";

const euro = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const euroCents = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const euroCompact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat(LOCALE);
const dateFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEuros(value: number | null | undefined, cents = false): string {
  if (value == null) return "—";
  return (cents ? euroCents : euro).format(value);
}

export function formatEurosCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 10_000 ? euro.format(value) : euroCompact.format(value);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

export function formatDate(value: DateInput): string {
  const date = toDate(value);
  return date ? dateFmt.format(date) : "—";
}

export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? dateTimeFmt.format(date) : "—";
}

/** "hoy", "mañana", "en 5 días", "hace 3 días". */
export function formatRelativeDays(value: DateInput, now = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  const hours = (date.getTime() - now.getTime()) / 3_600_000;
  if (Math.abs(hours) < 24 && date.toDateString() === now.toDateString()) {
    return Math.abs(hours) < 1 ? relative.format(Math.round(hours * 60), "minute") : "hoy";
  }
  const days = Math.round(hours / 24);
  return relative.format(days, "day");
}

export function daysUntil(value: DateInput, now = new Date()): number | null {
  const date = toDate(value);
  return date ? (date.getTime() - now.getTime()) / 86_400_000 : null;
}

/** `<input type="date">` value (YYYY-MM-DD) in Madrid time. */
export function toDateInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

export function pluralize(n: number, one: string, many: string): string {
  return `${formatInteger(n)} ${n === 1 ? one : many}`;
}
