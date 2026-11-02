/** Photos people upload (cats, profile photos): checked by their bytes, then stored. */
import { randomUUID } from "node:crypto";

import { getStorage } from "@felina/storage";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, type PhotoType } from "@felina/schemas/cat";

import { DomainError } from "./context.ts";

function sniffImageType(bytes: Uint8Array): PhotoType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Stores an image under `prefix/` and returns its key. The type is taken from the
 * file's bytes, not from what the client claims.
 */
export async function storeImage(
  bytes: Uint8Array,
  prefix: string,
  uploadedBy: string,
): Promise<string> {
  if (bytes.byteLength === 0) throw new DomainError("VALIDATION", "El archivo está vacío");
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new DomainError("VALIDATION", "La foto no puede superar los 8 MB");
  }
  const type = sniffImageType(bytes);
  if (!type) throw new DomainError("VALIDATION", "La foto debe ser JPG, PNG o WebP");
  const key = `${prefix}/${randomUUID()}.${PHOTO_TYPES[type]}`;
  await getStorage().put({ key, body: bytes, contentType: type, metadata: { uploadedBy } });
  return key;
}

export async function deleteImageQuietly(key: string | null): Promise<void> {
  if (!key) return;
  try {
    await getStorage().delete(key);
  } catch (error) {
    console.error(`[storage] could not delete ${key}`, error);
  }
}
