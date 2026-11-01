import { z } from "zod";

import { CAT_SEXES } from "@felina/domain/felina";

import { locationSchema, optionalText } from "./common.ts";

export const catNameSchema = z
  .string()
  .trim()
  .max(80, "Máximo 80 caracteres")
  .nullish()
  .transform((v) => (v ? v : null));

export const birthDateSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.iso.date().safeParse(v).success, "Fecha no válida")
  .refine(
    (v) => v === null || v <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    "La fecha de nacimiento no puede ser futura",
  );

/** Key returned by `POST /uploads/photos`; checked against the caller's organization. */
export const photoKeySchema = z
  .string({ error: "Añade la foto principal del gato" })
  .regex(
    /^cats\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/,
    "Añade la foto principal del gato",
  );

export const catInputSchema = z
  .object({
    colonyId: z
      .uuid()
      .nullish()
      .transform((v) => v ?? null),
    name: catNameSchema,
    sex: z.enum(CAT_SEXES).default("unknown"),
    birthDate: birthDateSchema,
    birthDateApproximate: z.boolean().default(false),
    description: optionalText(4000),
    photoKey: photoKeySchema,
  })
  .and(locationSchema);
export type CatInput = z.infer<typeof catInputSchema>;

export const catListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  colonyId: z.uuid().optional().catch(undefined),
  /** `none`: cats outside any colony. */
  colony: z.enum(["none"]).optional().catch(undefined),
  sex: z.enum(CAT_SEXES).optional().catch(undefined),
});
export type CatListQuery = z.infer<typeof catListSchema>;

export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
