/**
 * The API client used by the shared queries. Each app registers how to obtain it once at
 * start-up: the web app with its isomorphic client (same-origin proxy in the browser,
 * cookie forwarding during SSR), the mobile app with a client that sends the Better Auth
 * session stored on the device.
 */
import type { Api, ApiData } from "@felina/api-client";

let provider: (() => Api) | undefined;

export function configureApi(getApi: () => Api): void {
  provider = getApi;
}

export function api(): Api {
  if (!provider) throw new Error("configureApi() has not been called");
  return provider();
}

/** Signed-in user, platform-admin flag and organization (see `GET /api/v1/me`). */
export type Viewer = NonNullable<ApiData<Api["me"]["get"]>>;
