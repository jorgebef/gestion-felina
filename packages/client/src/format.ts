import { TIME_ZONE } from "@felina/domain/time";

const LOCALE = "es-ES";

const integer = new Intl.NumberFormat(LOCALE);
const dateFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
// Hermes (React Native on Android) has no Intl.RelativeTimeFormat: see `relativeTime`.
const relative =
  typeof Intl.RelativeTimeFormat === "function"
    ? new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" })
    : null;

/** "hace 3 días", "mañana", "en 5 minutos"… (Spanish fallback without Intl support). */
function relativeTime(value: number, unit: "minute" | "day"): string {
  if (relative) return relative.format(value, unit);
  if (unit === "day") {
    if (value === 0) return "hoy";
    if (value === 1) return "mañana";
    if (value === -1) return "ayer";
    if (value === 2) return "pasado mañana";
    if (value === -2) return "anteayer";
  } else if (value === 0) {
    return "este minuto";
  }
  const n = Math.abs(value);
  const word = unit === "day" ? (n === 1 ? "día" : "días") : n === 1 ? "minuto" : "minutos";
  return value > 0 ? `dentro de ${n} ${word}` : `hace ${n} ${word}`;
}

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  let date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) && typeof value === "string") {
    // Postgres text form ("2026-11-02 17:12:48.899+01"), which Hermes doesn't parse.
    date = new Date(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  }
  return Number.isNaN(date.getTime()) ? null : date;
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

/** "lun, 3 nov, 10:30". */
export function formatShortDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? weekdayFmt.format(date) : "—";
}

/** "hoy", "mañana", "en 5 días", "hace 3 días". */
export function formatRelativeDays(value: DateInput, now = new Date()): string {
  const date = toDate(value);
  if (!date) return "";
  const hours = (date.getTime() - now.getTime()) / 3_600_000;
  if (Math.abs(hours) < 24 && date.toDateString() === now.toDateString()) {
    return Math.abs(hours) < 1 ? relativeTime(Math.round(hours * 60), "minute") : "hoy";
  }
  return relativeTime(Math.round(hours / 24), "day");
}

/** `<input type="datetime-local">` value in Madrid time. */
export function toDateTimeLocalValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * ISO instant for a `datetime-local` value typed in Madrid time (the browser may be in
 * another zone, so the offset is computed for Madrid, not taken from the browser).
 */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  const offsetName =
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(asUtc)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetName);
  const minutes = match
    ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0;
  return new Date(asUtc.getTime() - minutes * 60_000).toISOString();
}

/** Age from a birth date ("3 años", "5 meses"). */
export function formatAge(birthDate: string | null, approximate = false): string {
  if (!birthDate) return "Edad desconocida";
  const born = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth();
  if (now.getDate() < born.getDate()) months -= 1;
  const prefix = approximate ? "≈ " : "";
  if (months < 1) return `${prefix}menos de 1 mes`;
  if (months < 12) return `${prefix}${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${prefix}${years} ${years === 1 ? "año" : "años"}`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${formatInteger(n)} ${n === 1 ? one : many}`;
}

/** `{ id: name }` map of colonies, the `items` that let a select show the chosen name. */
export function colonyLabels(
  colonies: readonly { id: string; name: string }[] | undefined,
): Record<string, string> {
  return Object.fromEntries((colonies ?? []).map((c) => [c.id, c.name]));
}
