import { z } from "zod";

import { isInSpain } from "@felina/domain/felina";
import { isMunicipalityCode } from "@felina/domain/municipalities";

export const idParamSchema = z.object({ id: z.uuid() });
export const tokenParamSchema = z.object({ token: z.string().min(20).max(200) });
export const searchTermSchema = z.object({ q: z.string().trim().max(100).default("") });

/** Optional free text: blank becomes `null` (clears the value). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

export const municipalityCodeSchema = z
  .string()
  .trim()
  .refine(isMunicipalityCode, "Elige un municipio de la lista");

/** Exact location: coordinates (in Spain), INE municipality and optional street address. */
export const locationSchema = z
  .object({
    latitude: z.number({ error: "Marca la ubicación en el mapa" }).min(-90).max(90),
    longitude: z.number({ error: "Marca la ubicación en el mapa" }).min(-180).max(180),
    municipalityCode: municipalityCodeSchema,
    address: optionalText(300),
  })
  .refine((v) => isInSpain(v.latitude, v.longitude), {
    message: "La ubicación debe estar en España",
    path: ["latitude"],
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Introduce un email válido"));

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Introduce un email válido");

export const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\+?[0-9 ().-]{6,20}$/.test(v), "Teléfono no válido");

/** Pagination for list endpoints. */
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).catch(25),
});
