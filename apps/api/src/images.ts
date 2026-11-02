/** Receiving and sending photos (cats and profile photos). */
import type { Context } from "hono";

import { DomainError } from "@felina/core/context";
import { MAX_PHOTO_BYTES } from "@felina/schemas/cat";

/** The `file` field of a multipart/form-data request. */
export async function uploadedImage(c: Context): Promise<Uint8Array> {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) throw new DomainError("VALIDATION", "Adjunta una foto");
  if (file.size > MAX_PHOTO_BYTES) {
    throw new DomainError("VALIDATION", "La foto no puede superar los 8 MB");
  }
  return new Uint8Array(await file.arrayBuffer());
}

/** A stored image; URLs carry a version (`?v=`), so it can be cached for a day. */
export function imageResponse(
  c: Context,
  photo: { body: unknown; contentType: string } | null,
  visibility: "private" | "public" = "private",
) {
  if (!photo) throw new DomainError("NOT_FOUND", "Foto no disponible");
  return c.body(photo.body as Uint8Array<ArrayBuffer>, 200, {
    "content-type": photo.contentType,
    "cache-control": `${visibility}, max-age=86400`,
    "x-content-type-options": "nosniff",
  });
}
