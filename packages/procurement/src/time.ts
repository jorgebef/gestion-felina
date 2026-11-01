const MADRID = "Europe/Madrid";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MADRID,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Offset of Europe/Madrid from UTC at `instant`, in milliseconds (+1h or +2h). */
function madridOffset(instant: number): number {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant;
}

/**
 * Converts a Spanish peninsular wall-clock date/time (as published without offset,
 * e.g. EndDate 2026-11-11 + EndTime 14:00:00) into a UTC instant.
 */
export function madridLocalToDate(date: string, time = "00:00:00"): Date | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!d) return undefined;
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(time.trim()) ?? ["", "00", "00", "00"];
  const wall = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1]!, +t[2]!, +(t[3] ?? 0));
  let instant = wall - madridOffset(wall);
  instant = wall - madridOffset(instant); // second pass settles DST transitions
  return new Date(instant);
}

export function parseInstant(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
