import { z } from "zod";

import { DELETION_STATUSES, DELETION_TARGETS } from "@felina/domain/felina";

import { optionalText } from "./common.ts";

/** Asking an association admin to delete a colony, cat or action. */
export const deletionRequestInputSchema = z.object({
  targetType: z.enum(DELETION_TARGETS),
  targetId: z.uuid(),
  reason: optionalText(1000),
});
export type DeletionRequestInput = z.infer<typeof deletionRequestInputSchema>;

/** Approving (the target is deleted) or rejecting a deletion request. */
export const deletionResolutionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: optionalText(1000),
});
export type DeletionResolution = z.infer<typeof deletionResolutionSchema>;

export const deletionListSchema = z.object({
  status: z.enum(DELETION_STATUSES).optional().catch(undefined),
});
export type DeletionListQuery = z.infer<typeof deletionListSchema>;

export const colonyManagerInputSchema = z.object({ userId: z.uuid() });
