/**
 * Better Auth on the device: the session cookie is kept in the secure store (Keychain /
 * Keystore) and sent to the API as a header; OAuth opens the browser and comes back
 * through the app's scheme. Same server, same accounts as the web app.
 */
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { API_URL, APP_SCHEME } from "./env";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage: SecureStore,
    }),
  ],
});

/** Headers that authenticate a request to /api/v1 as the signed-in user. */
export async function sessionHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return cookie ? { cookie } : {};
}
