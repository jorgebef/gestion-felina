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
 * Source (URL + session headers) for an image the API only serves to signed-in people:
 * cat photos and profile photos. The session headers are cached under the viewer's query
 * key, so they refresh with it.
 */
export function useAuthedImageSource(uri: string | undefined) {
  const headers = useQuery({
    queryKey: ["viewer", "session-headers"],
    queryFn: sessionHeaders,
    staleTime: Infinity,
  });
  return uri && headers.data ? { uri, headers: headers.data } : undefined;
}

/** URL and headers to display a cat's photo. */
export function useCatPhotoSource(catId: string, version?: string) {
  return useAuthedImageSource(client.cats.photoUrl(catId, version));
}
