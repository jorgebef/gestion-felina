import { z } from "zod";

import { CAT_SEXES, PROPOSAL_STATUSES, isInSpain } from "@felina/domain/felina";

import { municipalityCodeSchema, optionalText } from "./common.ts";
import { birthDateSchema, catNameSchema } from "./cat.ts";
import { colonyNameSchema } from "./colony.ts";

const coordinates = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

function coordinatesInSpain(v: { latitude?: number; longitude?: number }) {
  if (v.latitude === undefined && v.longitude === undefined) return true;
  return (
    v.latitude !== undefined && v.longitude !== undefined && isInSpain(v.latitude, v.longitude)
  );
}

const atLeastOne = (v: object) => Object.values(v).some((value) => value !== undefined);

/** Only the fields being changed are sent; omitted fields stay as they are. */
export const colonyChangesSchema = z
  .object({
    name: colonyNameSchema.optional(),
    description: optionalText(4000).optional(),
    address: optionalText(300).optional(),
    municipalityCode: municipalityCodeSchema.optional(),
    ...coordinates,
  })
  .strict()
  .refine(atLeastOne, "Indica al menos un cambio")
  .refine(coordinatesInSpain, "La ubicación propuesta debe estar en España");
export type ColonyChanges = z.infer<typeof colonyChangesSchema>;

export const catChangesSchema = z
  .object({
    name: catNameSchema.optional(),
    sex: z.enum(CAT_SEXES).optional(),
    birthDate: birthDateSchema.optional(),
    birthDateApproximate: z.boolean().optional(),
    sterilized: z.boolean().optional(),
    description: optionalText(4000).optional(),
    address: optionalText(300).optional(),
    municipalityCode: municipalityCodeSchema.optional(),
    ...coordinates,
  })
  .strict()
  .refine(atLeastOne, "Indica al menos un cambio")
  .refine(coordinatesInSpain, "La ubicación propuesta debe estar en España");
export type CatChanges = z.infer<typeof catChangesSchema>;

export const proposalMessageSchema = optionalText(2000);

export const colonyProposalSchema = z.object({
  changes: colonyChangesSchema,
  message: proposalMessageSchema,
});
export const catProposalSchema = z.object({
  changes: catChangesSchema,
  message: proposalMessageSchema,
});

export const proposalResolutionSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  note: optionalText(1000),
});
export type ProposalResolution = z.infer<typeof proposalResolutionSchema>;

export const proposalListSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional().catch(undefined),
});
export type ProposalListQuery = z.infer<typeof proposalListSchema>;
