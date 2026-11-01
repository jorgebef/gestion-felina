import { z } from "zod";

import { isProvinceCode } from "@licita/domain/provinces";
import { sectorById } from "@licita/domain/sectors";
import { CONTRACT_TYPES, EMAIL_FREQUENCIES } from "@licita/domain/tenders";

const keyword = z.string().trim().min(2).max(80);
const budget = z
  .number()
  .nonnegative("El importe no puede ser negativo")
  .max(10_000_000_000_000)
  .nullable();

export const alertProfileInputSchema = z
  .object({
    name: z.string().trim().min(2, "Pon un nombre al perfil").max(120),
    serviceDescription: z
      .string()
      .trim()
      .min(10, "Describe en una frase qué hace tu empresa")
      .max(2000),
    sectors: z
      .array(z.string())
      .max(10)
      .refine((ids) => ids.every((id) => sectorById(id)), "Sector no válido"),
    cpvCodes: z.array(z.string().regex(/^\d{8}$/, "Código CPV no válido")).max(60),
    includeKeywords: z.array(keyword).max(30),
    excludeKeywords: z.array(keyword).max(30),
    provinceCodes: z
      .array(z.string())
      .max(52)
      .refine((codes) => codes.every(isProvinceCode), "Provincia no válida"),
    nationwide: z.boolean(),
    contractTypes: z.array(z.enum(CONTRACT_TYPES)).max(CONTRACT_TYPES.length),
    minBudgetEur: budget,
    maxBudgetEur: budget,
    emailFrequency: z.enum(EMAIL_FREQUENCIES),
    isActive: z.boolean(),
  })
  .refine((v) => v.nationwide || v.provinceCodes.length > 0, {
    message: "Elige al menos una provincia o marca toda España",
    path: ["provinceCodes"],
  })
  .refine(
    (v) => v.minBudgetEur == null || v.maxBudgetEur == null || v.minBudgetEur <= v.maxBudgetEur,
    { message: "El mínimo no puede superar al máximo", path: ["maxBudgetEur"] },
  )
  .transform((v) => ({
    ...v,
    cpvCodes: [...new Set(v.cpvCodes)],
    includeKeywords: [...new Set(v.includeKeywords)],
    excludeKeywords: [...new Set(v.excludeKeywords)],
    provinceCodes: v.nationwide ? [] : [...new Set(v.provinceCodes)].sort(),
  }));

export type AlertProfileInput = z.input<typeof alertProfileInputSchema>;
export type AlertProfileValues = z.output<typeof alertProfileInputSchema>;

export const alertProfileActiveSchema = z.object({ isActive: z.boolean() });
