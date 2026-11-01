/** Dates in the platform's time zone (Europe/Madrid). */

export const TIME_ZONE = "Europe/Madrid";

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/** Start and end (exclusive) of the Madrid calendar day containing `day`, as instants. */
export function madridDayBounds(day: Date): { start: Date; end: Date; key: string } {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(day);
  const utcMidnight = new Date(`${key}T00:00:00Z`);
  const start = new Date(utcMidnight.getTime() - offsetMinutes(utcMidnight) * 60_000);
  const nextUtc = new Date(utcMidnight.getTime() + 86_400_000);
  const end = new Date(nextUtc.getTime() - offsetMinutes(nextUtc) * 60_000);
  return { start, end, key };
}
