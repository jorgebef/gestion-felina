import type { z } from "zod";

import { m } from "#/paraglide/messages";

/** Turns a zod issue into a translated, user-facing message. */
export function issueMessage(issue: z.core.$ZodIssue): string {
  if (issue.message === "paid_off_too_high") return m.validation_paid_off();
  if (issue.message === "invalid_date") return m.validation_date();
  switch (issue.code) {
    case "invalid_type":
      return issue.expected === "number" ? m.validation_number() : m.validation_required();
    case "too_small":
      return issue.minimum === 1 && issue.origin === "string"
        ? m.validation_required()
        : m.validation_positive();
    case "too_big":
      return m.validation_too_big();
    default:
      return m.validation_required();
  }
}

/** Maps zod issues to TanStack Form field errors (`a.b[0].c` paths). */
export function zodFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.reduce<string>((acc, part) => {
      if (typeof part === "number") return `${acc}[${part}]`;
      return acc ? `${acc}.${String(part)}` : String(part);
    }, "");
    if (path && !fields[path]) fields[path] = issueMessage(issue);
  }
  return fields;
}

/** Parses a form string into a number; blank becomes `fallback`, garbage becomes NaN. */
export function parseNumber(value: string, fallback: number): number;
export function parseNumber(value: string, fallback: null): number | null;
export function parseNumber(value: string, fallback: number | null): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  return Number(trimmed);
}
