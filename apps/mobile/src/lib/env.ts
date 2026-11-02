/**
 * Origin serving `/api` (`/api/v1` and Better Auth's `/api/auth`): the web app, which
 * proxies to apps/api, or the API itself. Set EXPO_PUBLIC_API_URL in apps/mobile/.env.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** Deep-link scheme (app.json → expo.scheme), also trusted by Better Auth in apps/api. */
export const APP_SCHEME = "gestionfelina";
