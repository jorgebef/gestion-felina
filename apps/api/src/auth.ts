import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authAccounts, authSessions, authVerifications, getDb, users } from "@licita/db";
import { getMailer } from "@licita/notifications/mailer";
import { passwordResetEmail } from "@licita/notifications/templates";

import { apiEnv } from "./env.ts";

const env = apiEnv();

export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

// An origin without a path (validated in ./env.ts): Better Auth would otherwise use the
// path as its base path instead of /api/auth.
const baseURL = env.BETTER_AUTH_URL ?? env.APP_URL;

export const auth = betterAuth({
  // Must match the mount point in ./app.ts (and the web app's /api proxy).
  basePath: "/api/auth",
  baseURL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    env.APP_URL,
    ...(env.TRUSTED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: users,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  // The public `users` table (packages/db/migrations/0001) is Better Auth's user model.
  user: { fields: { name: "fullName" } },
  advanced: {
    database: { generateId: "uuid" },
    // The web app's proxy forwards the browser's address (used by the rate limiter).
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await getMailer().send(passwordResetEmail({ to: user.email, url }));
    },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,
});
