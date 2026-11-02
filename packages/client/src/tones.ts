/**
 * Status → colour tone, and the Tailwind classes of each tone. The same class names work
 * on the web (Tailwind) and on mobile (Uniwind), so both apps' badges read the same.
 */
import type { ActionStatus, OrganizationStatus, ProposalStatus } from "@felina/domain/felina";

export type Tone = "neutral" | "brand" | "positive" | "warning" | "negative" | "muted";

/**
 * Classes of each tone: `box` for a pill's border and fill, `text` for its label (and for
 * icons or text outside a pill). On the web both go on the same element.
 */
export const TONE_STYLES: Record<Tone, { box: string; text: string }> = {
  neutral: { box: "border-border bg-card", text: "text-foreground" },
  brand: { box: "border-brand/20 bg-brand-soft", text: "text-brand-strong" },
  positive: { box: "border-positive/20 bg-positive-soft", text: "text-positive" },
  warning: { box: "border-warning/20 bg-warning-soft", text: "text-warning" },
  negative: { box: "border-negative/20 bg-negative-soft", text: "text-negative" },
  muted: { box: "border-border bg-muted", text: "text-muted-foreground" },
};

export const ACTION_STATUS_TONE: Record<ActionStatus, Tone> = {
  planned: "brand",
  in_progress: "warning",
  done: "positive",
  cancelled: "muted",
};

export const ORGANIZATION_STATUS_TONE: Record<OrganizationStatus, Tone> = {
  pending: "warning",
  approved: "positive",
  rejected: "negative",
  suspended: "negative",
};

export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, Tone> = {
  pending: "warning",
  accepted: "positive",
  rejected: "negative",
  withdrawn: "muted",
};

/** Validation of an action by the town hall. */
export function validationTone(validatedAt: unknown, modifiedAfterValidation = false): Tone {
  if (!validatedAt) return "muted";
  return modifiedAfterValidation ? "warning" : "positive";
}

export function validationLabel(validatedAt: unknown, modifiedAfterValidation = false): string {
  if (!validatedAt) return "Sin validar";
  return modifiedAfterValidation ? "Validada · modificada" : "Validada";
}
