/**
 * Transactional email transport, selected with EMAIL_PROVIDER. Only server code
 * (auth callbacks and scheduled jobs) sends email; the browser never does.
 */
import { notificationsEnv } from "./env.ts";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Lets the provider drop a retried request it already accepted. */
  idempotencyKey?: string;
}

export interface SendResult {
  providerMessageId: string;
}

export interface Mailer {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export class MailerError extends Error {
  constructor(
    message: string,
    /** Retrying later may succeed (rate limit, provider outage). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "MailerError";
  }
}

/** https://resend.com/docs/api-reference/emails/send-email */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    name: "resend",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new MailerError(
          `Resend ${response.status}: ${body.slice(0, 300)}`,
          response.status === 429 || response.status >= 500,
        );
      }
      const { id } = (await response.json()) as { id: string };
      return { providerMessageId: id };
    },
  };
}

/** Development transport: prints the message instead of sending it. */
export function consoleMailer(): Mailer & { outbox: EmailMessage[] } {
  const outbox: EmailMessage[] = [];
  return {
    name: "console",
    outbox,
    async send(message) {
      outbox.push(message);
      console.info(
        `[email:console] to=${message.to} subject="${message.subject}"\n${message.text}\n`,
      );
      return { providerMessageId: `console-${crypto.randomUUID()}` };
    },
  };
}

export function disabledMailer(): Mailer {
  return {
    name: "disabled",
    async send() {
      throw new MailerError("Email is disabled (EMAIL_PROVIDER=disabled)", false);
    },
  };
}

let instance: Mailer | undefined;

export function getMailer(): Mailer {
  if (instance) return instance;
  const env = notificationsEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
    instance = resendMailer(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else if (env.EMAIL_PROVIDER === "disabled") {
    instance = disabledMailer();
  } else {
    instance = consoleMailer();
  }
  return instance;
}

/** Test hook. */
export function setMailer(mailer: Mailer | undefined): void {
  instance = mailer;
}
