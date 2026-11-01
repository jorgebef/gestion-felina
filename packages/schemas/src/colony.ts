import { z } from "zod";

import { locationSchema, optionalText } from "./common.ts";

export const colonyNameSchema = z
  .string()
  .trim()
  .min(2, "Indica el nombre de la colonia")
  .max(120, "Máximo 120 caracteres");

export const colonyInputSchema = z
  .object({
    name: colonyNameSchema,
    description: optionalText(4000),
  })
  .and(locationSchema);
export type ColonyInput = z.infer<typeof colonyInputSchema>;

export const colonyListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  authorized: z.enum(["yes", "no"]).optional().catch(undefined),
});
export type ColonyListQuery = z.infer<typeof colonyListSchema>;

export const authorizationSchema = z.object({ authorized: z.boolean() });
