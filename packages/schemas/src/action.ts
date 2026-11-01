import { z } from "zod";

import { ACTION_STATUSES, ACTION_TYPES } from "@felina/domain/felina";

import { municipalityCodeSchema, optionalText } from "./common.ts";

export const actionInputSchema = z
  .object({
    actionType: z.enum(ACTION_TYPES, { error: "Elige el tipo de acción" }),
    name: z.string().trim().min(2, "Indica un nombre").max(160, "Máximo 160 caracteres"),
    description: optionalText(4000),
    scheduledAt: z.iso.datetime({ offset: true, error: "Indica la fecha y la hora" }),
    isUrgent: z.boolean().default(false),
    status: z.enum(ACTION_STATUSES).default("planned"),
    colonyId: z
      .uuid()
      .nullish()
      .transform((v) => v ?? null),
    /** Only used when there is no colony; otherwise the colony's municipality applies. */
    municipalityCode: municipalityCodeSchema.nullish().transform((v) => v ?? null),
    catIds: z.array(z.uuid()).max(200).default([]),
    participantIds: z.array(z.uuid()).max(100).default([]),
  })
  .refine((v) => v.colonyId || v.municipalityCode || v.catIds.length, {
    message: "Elige una colonia, algún gato o el municipio de la acción",
    path: ["colonyId"],
  });
export type ActionInput = z.infer<typeof actionInputSchema>;

export const actionStatusSchema = z.object({ status: z.enum(ACTION_STATUSES) });

export const actionListSchema = z.object({
  status: z.enum(ACTION_STATUSES).optional().catch(undefined),
  type: z.enum(ACTION_TYPES).optional().catch(undefined),
  colonyId: z.uuid().optional().catch(undefined),
  catId: z.uuid().optional().catch(undefined),
  validation: z.enum(["pending", "validated"]).optional().catch(undefined),
  urgent: z.enum(["yes"]).optional().catch(undefined),
  /** `upcoming`: not done/cancelled, from today on. `past`: before now. */
  when: z.enum(["upcoming", "past"]).optional().catch(undefined),
  /** Town halls: actions of their municipality, newest first (the "feed"). */
  view: z.enum(["feed"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type ActionListQuery = z.infer<typeof actionListSchema>;

export const validationSchema = z.object({ validated: z.boolean() });
