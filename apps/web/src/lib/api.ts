/**
 * The typed API client for this app. In the browser it calls the same-origin /api
 * proxy; during server-side rendering it calls the API directly and forwards the
 * visitor's cookie, so loaders see the same session as the browser.
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { createApi, type Api, type ApiData } from "@felina/api-client";

import { apiOrigin } from "./api-origin";

let browserApi: Api | undefined;

export const api = createIsomorphicFn()
  .server((): Api =>
    createApi({
      baseUrl: apiOrigin(),
      headers: (): Record<string, string> => {
        const cookie = getRequestHeader("cookie");
        return cookie ? { cookie } : {};
      },
    }),
  )
  .client((): Api => {
    browserApi ??= createApi({ baseUrl: window.location.origin });
    return browserApi;
  });

/** Signed-in user, platform-admin flag and organization (see `GET /api/v1/me`). */
export type Viewer = NonNullable<ApiData<Api["me"]["get"]>>;
