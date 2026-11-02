/** Helpers for forms validated with the shared zod schemas (@felina/schemas). */

/** First message of each top-level field, from a zod error's issues. */
export function fieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}
