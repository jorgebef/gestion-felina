import { z } from "zod";

import { WORKFLOW_STATUSES } from "@licita/domain/tenders";

export const trackedListSchema = z.object({
  status: z.enum(WORKFLOW_STATUSES).optional().catch(undefined),
});

export const trackedUpdateSchema = z.object({
  workflowStatus: z.enum(WORKFLOW_STATUSES).optional(),
  notes: z.string().max(10_000).nullable().optional(),
});
export type TrackedUpdate = z.infer<typeof trackedUpdateSchema>;

export const taskInputSchema = z.object({
  title: z.string().trim().min(2, "Describe la tarea").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || undefined),
  dueAt: z.iso.datetime({ offset: true }).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskCompletionSchema = z.object({ completed: z.boolean() });
