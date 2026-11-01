import { z } from "zod";

import { MEMBER_ROLES, ORGANIZATION_KINDS, ORGANIZATION_STATUSES } from "@felina/domain/felina";

import {
  emailSchema,
  municipalityCodeSchema,
  optionalEmail,
  optionalPhone,
  optionalText,
} from "./common.ts";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Indica el nombre de la organización")
  .max(200, "Máximo 200 caracteres");

// Optional CIF/NIF. Never required: the platform works without it.
const taxIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[A-Z0-9]{8,10}$/.test(v), "CIF/NIF no válido");

/** Data an organization's admins can edit. */
export const organizationUpdateSchema = z.object({
  name: nameSchema,
  taxId: taxIdSchema,
  description: optionalText(2000),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
});
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;

/** Self-service sign-up of an association (pending until the super admin approves it). */
export const associationRegistrationSchema = organizationUpdateSchema.extend({
  municipalityCode: municipalityCodeSchema.nullish().transform((v) => v ?? null),
});
export type AssociationRegistration = z.infer<typeof associationRegistrationSchema>;

/** Super admin: create the town hall of a municipality and invite its first admin. */
export const townHallCreateSchema = z.object({
  municipalityCode: municipalityCodeSchema,
  name: optionalText(200),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  adminEmail: emailSchema,
});
export type TownHallCreate = z.infer<typeof townHallCreateSchema>;

export const organizationReviewSchema = z.object({
  status: z.enum(ORGANIZATION_STATUSES),
  note: optionalText(1000),
});
export type OrganizationReview = z.infer<typeof organizationReviewSchema>;

export const organizationListSchema = z.object({
  status: z.enum(ORGANIZATION_STATUSES).optional().catch(undefined),
  kind: z.enum(ORGANIZATION_KINDS).optional().catch(undefined),
  q: z.string().trim().max(100).optional(),
});
export type OrganizationListQuery = z.infer<typeof organizationListSchema>;

export const invitationInputSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBER_ROLES).default("member"),
});
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const memberRoleSchema = z.object({ role: z.enum(MEMBER_ROLES) });

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Indica tu nombre").max(120),
});
export type UserProfileInput = z.infer<typeof userProfileSchema>;
