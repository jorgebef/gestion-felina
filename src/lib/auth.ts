import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/db/index";
import * as schema from "#/db/schema";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const isGoogleAuthEnabled = Boolean(googleClientId && googleClientSecret);

// Better Auth treats any path in BETTER_AUTH_URL as its base path, which moves every
// endpoint (including the OAuth callback) away from /api/auth and breaks sign-in.
const authUrl = process.env.BETTER_AUTH_URL;
if (authUrl && URL.canParse(authUrl) && new URL(authUrl).pathname !== "/") {
  console.warn(
    `[auth] BETTER_AUTH_URL should be this app's origin (e.g. http://localhost:3000), got a URL with a path: ${new URL(authUrl).origin}${new URL(authUrl).pathname}`,
  );
}

export const auth = betterAuth({
  // Must match the catch-all route in src/routes/api/auth/$.ts.
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : undefined,
  plugins: [tanstackStartCookies()],
});
