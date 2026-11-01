import { z } from "zod";

import { isProvinceCode } from "@licita/domain/provinces";

export const COMPANY_TYPES = ["autonomo", "sociedad", "otro"] as const;
export const COMPANY_TYPE_LABELS: Record<(typeof COMPANY_TYPES)[number], string> = {
  autonomo: "Autónomo/a",
  sociedad: "Sociedad (S.L., S.A., cooperativa…)",
  otro: "Otro tipo de entidad",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const companyInputSchema = z.object({
  legalName: z.string().trim().min(2, "Indica el nombre de la empresa").max(200),
  displayName: optionalText(120),
  companyType: z.enum(COMPANY_TYPES).optional(),
  baseProvinceCode: z
    .string()
    .optional()
    .refine((v) => !v || isProvinceCode(v), "Provincia no válida")
    .transform((v) => v || undefined),
  baseMunicipality: optionalText(120),
  businessDescription: optionalText(2000),
  // Optional NIF/CIF. Never requested at sign-up (data minimisation).
  taxId: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || /^[A-Z0-9]{8,10}$/.test(v), "NIF/CIF no válido")
    .transform((v) => v || undefined),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Indica tu nombre").max(120),
});
export type UserProfileInput = z.infer<typeof userProfileSchema>;
