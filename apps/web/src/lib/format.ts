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
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
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
    return Math.abs(hours) < 1 ? relative.format(Math.round(hours * 60), "minute") : "hoy";
  }
  return relative.format(Math.round(hours / 24), "day");
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
