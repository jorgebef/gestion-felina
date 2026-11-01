/** API configuration, validated once on first use. */
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const schema = z.object({
  /** Port of the API process. The web app proxies /api/* here. */
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  /**
   * Public origin of the web app. Browsers reach the API through the web app's /api
   * proxy, so this is also Better Auth's base URL (OAuth callbacks, email links).
   */
  APP_URL: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: optional,
  /**
   * Overrides APP_URL as Better Auth's base URL. Origin only: Better Auth treats a path
   * here as its base path, which moves every endpoint away from /api/auth (all 404).
   */
  BETTER_AUTH_URL: optional.refine(
    (v) => v === undefined || (URL.canParse(v) && new URL(v).pathname === "/"),
    "must be the web app's origin without a path, e.g. http://localhost:3000",
  ),
  /** Extra origins allowed to call the API with cookies (comma-separated). */
  TRUSTED_ORIGINS: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
});

export type ApiEnv = z.infer<typeof schema>;

let cached: ApiEnv | undefined;

export function apiEnv(): ApiEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid API environment: ${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
