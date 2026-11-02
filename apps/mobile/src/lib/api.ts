/**
 * The typed API client (@felina/api-client) for the app. The shared query options in
 * @felina/client call the API through it.
 */
import { useQuery } from "@tanstack/react-query";

import { createApi, type Api } from "@felina/api-client";
import { configureApi } from "@felina/client/api";

import { sessionHeaders } from "./auth-client";
import { API_URL } from "./env";

const client: Api = createApi({
  baseUrl: API_URL,
  headers: sessionHeaders,
  // The session travels in the `cookie` header; React Native's own cookie jar must not
  // add (or keep) cookies of its own.
  fetch: (input, init) => fetch(input, { ...init, credentials: "omit" }),
});

export function api(): Api {
  return client;
}

configureApi(api);

/**
 * URL and headers to display a cat's photo (the endpoint requires the session). The
 * session headers are cached under the viewer's query key, so they refresh with it.
 */
export function useCatPhotoSource(catId: string, version?: string) {
  const headers = useQuery({
    queryKey: ["viewer", "session-headers"],
    queryFn: sessionHeaders,
    staleTime: Infinity,
  });
  return headers.data
    ? { uri: client.cats.photoUrl(catId, version), headers: headers.data }
    : undefined;
}
