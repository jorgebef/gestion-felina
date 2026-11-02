/**
 * The typed API client for this app. In the browser it calls the same-origin /api
 * proxy; during server-side rendering it calls the API directly and forwards the
 * visitor's cookie, so loaders see the same session as the browser.
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { createApi, type Api } from "@felina/api-client";
import { configureApi } from "@felina/client/api";

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

// The shared query options (@felina/client/queries) call the API through this client.
configureApi(api);

export type { Viewer } from "@felina/client/api";
