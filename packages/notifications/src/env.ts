/** Email and link settings, read from the environment on first use. */
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const schema = z.object({
  /** Public origin of the web app, used for links in emails. */
  APP_URL: z.url().default("http://localhost:3000"),
  /** `resend` sends real email; `console` logs it (development); `disabled` drops it. */
  EMAIL_PROVIDER: z.enum(["resend", "console", "disabled"]).default("console"),
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("GestiónFelina <avisos@example.com>"),
});

export type NotificationsEnv = z.infer<typeof schema>;

let cached: NotificationsEnv | undefined;

export function notificationsEnv(): NotificationsEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid email configuration: ${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
