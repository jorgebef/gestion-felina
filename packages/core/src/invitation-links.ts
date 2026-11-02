/**
 * Recoverable invitation links. The token is looked up by its hash, and also stored
 * encrypted (AES-256-GCM, key derived from BETTER_AUTH_SECRET) so organization admins and
 * the platform admin can copy an open invitation's link again without re-sending it.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { appUrl } from "@felina/notifications/templates";

const VERSION = "v1";
/** Better Auth also falls back to a built-in secret outside production. */
const DEV_SECRET = "felina-development-only-secret";

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required to store invitation links");
  }
  return createHash("sha256")
    .update(`felina:invitation-link:${secret || DEV_SECRET}`)
    .digest();
}

export function sealInvitationToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [VERSION, iv, data, cipher.getAuthTag()]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** The token, or null when it was never stored or the server secret has changed. */
export function openInvitationToken(sealed: string | null): string | null {
  const [version, iv, data, tag] = sealed?.split(".") ?? [];
  if (version !== VERSION || !iv || !data || !tag) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function invitationUrl(token: string): string {
  return appUrl(`/invitacion/${token}`);
}

/** Replaces a listed invitation's stored ciphertext with its link (null if unavailable). */
export function withInvitationUrl<T extends { tokenCiphertext: string | null }>({
  tokenCiphertext,
  ...invitation
}: T): Omit<T, "tokenCiphertext"> & { url: string | null } {
  const token = openInvitationToken(tokenCiphertext);
  return { ...invitation, url: token ? invitationUrl(token) : null };
}
