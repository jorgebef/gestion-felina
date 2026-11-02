/**
 * Typed client for the GestiónFelina API (`/api/v1`). Request and response types come from
 * the Hono routes in apps/api, so a change there is a type error here and in every
 * caller. Dates arrive as ISO strings, exactly as they travel over JSON.
 *
 *   const api = createApi({ baseUrl: "https://app.example.es" });
 *   const colonies = await api.colonies.list({ q: "parque" });
 */
import { hc, type ClientResponse, type InferRequestType } from "hono/client";

import type { ApiRoutes } from "@felina/api";
import type { ActionStatus, DeletionStatus, ProposalStatus } from "@felina/domain/felina";
import type { ActionListQuery } from "@felina/schemas/action";
import type { CatListQuery } from "@felina/schemas/cat";
import type { ColonyListQuery } from "@felina/schemas/colony";
import type { OrganizationListQuery } from "@felina/schemas/organization";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NO_ORGANIZATION"
  | "ORGANIZATION_NOT_APPROVED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** A local file as React Native's `FormData` expects it (e.g. from expo-image-picker). */
export interface NativeFile {
  uri: string;
  name: string;
  type: string;
}

export interface ApiOptions {
  /** Origin serving `/api/v1` (the web app's origin when going through its proxy). */
  baseUrl: string;
  /** Extra headers per request, e.g. the incoming cookie during server-side rendering. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: typeof fetch;
}

export function createRawClient(options: ApiOptions) {
  return hc<ApiRoutes>(`${options.baseUrl.replace(/\/$/, "")}/api/v1`, {
    headers: options.headers,
    fetch: options.fetch,
    init: { credentials: "include" },
  });
}

type RawClient = ReturnType<typeof createRawClient>;

async function unwrap<T>(request: Promise<ClientResponse<T>>): Promise<T> {
  let response: ClientResponse<T>;
  try {
    response = await request;
  } catch (error) {
    throw new ApiError(0, "NETWORK", (error as Error).message);
  }
  if (response.ok) return (await response.json()) as T;
  let body: { error?: { code?: ErrorCode; message?: string } } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Not a JSON error body (proxy or gateway error).
  }
  throw new ApiError(
    response.status,
    body.error?.code ?? (response.status === 401 ? "UNAUTHORIZED" : "INTERNAL"),
    body.error?.message ?? response.statusText,
  );
}

type Json<T> = T extends { json: infer J } ? J : never;

/** Query string values; unset values are omitted. */
function toQuery<T extends object>(params: T): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query[key] = String(value);
  }
  return query;
}

/** JSON body accepted by a raw client method. */
type Body<F> = Json<InferRequestType<F>>;

export function createApi(options: ApiOptions) {
  const c: RawClient = createRawClient(options);
  const base = `${options.baseUrl.replace(/\/$/, "")}/api/v1`;
  const doFetch = options.fetch ?? fetch;

  return {
    public: {
      authConfig: () => unwrap(c.public["auth-config"].$get()),
      invitation: (token: string) =>
        unwrap(c.public.invitations[":token"].$get({ param: { token } })),
    },
    me: {
      /** Signed-in user, platform-admin flag and organization, or null when anonymous. */
      get: () => unwrap(c.me.$get()),
      profile: () => unwrap(c.me.profile.$get()),
      update: (json: Body<RawClient["me"]["$patch"]>) => unwrap(c.me.$patch({ json })),
    },
    organizations: {
      register: (json: Body<RawClient["organizations"]["$post"]>) =>
        unwrap(c.organizations.$post({ json })),
      current: () => unwrap(c.organizations.current.$get()),
      updateCurrent: (json: Body<RawClient["organizations"]["current"]["$patch"]>) =>
        unwrap(c.organizations.current.$patch({ json })),
      members: () => unwrap(c.organizations.current.members.$get()),
      setMemberRole: (id: string, role: "admin" | "member") =>
        unwrap(c.organizations.current.members[":id"].$patch({ param: { id }, json: { role } })),
      removeMember: (id: string) =>
        unwrap(c.organizations.current.members[":id"].$delete({ param: { id } })),
      invitations: () => unwrap(c.organizations.current.invitations.$get()),
      invite: (json: Body<RawClient["organizations"]["current"]["invitations"]["$post"]>) =>
        unwrap(c.organizations.current.invitations.$post({ json })),
    },
    invitations: {
      accept: (token: string) => unwrap(c.invitations[":token"].accept.$post({ param: { token } })),
      revoke: (id: string) => unwrap(c.invitations[":id"].$delete({ param: { id } })),
    },
    municipalities: {
      search: (q: string) => unwrap(c.municipalities.$get({ query: { q } })),
      get: (code: string) => unwrap(c.municipalities[":code"].$get({ param: { code } })),
    },
    colonies: {
      list: (query: ColonyListQuery = {}) => unwrap(c.colonies.$get({ query: toQuery(query) })),
      options: () => unwrap(c.colonies.options.$get()),
      get: (id: string) => unwrap(c.colonies[":id"].$get({ param: { id } })),
      create: (json: Body<RawClient["colonies"]["$post"]>) => unwrap(c.colonies.$post({ json })),
      update: (id: string, json: Body<RawClient["colonies"][":id"]["$put"]>) =>
        unwrap(c.colonies[":id"].$put({ param: { id }, json })),
      delete: (id: string) => unwrap(c.colonies[":id"].$delete({ param: { id } })),
      setAuthorization: (id: string, authorized: boolean) =>
        unwrap(c.colonies[":id"].authorization.$put({ param: { id }, json: { authorized } })),
      propose: (id: string, json: Body<RawClient["colonies"][":id"]["proposals"]["$post"]>) =>
        unwrap(c.colonies[":id"].proposals.$post({ param: { id }, json })),
      addManager: (id: string, userId: string) =>
        unwrap(c.colonies[":id"].managers.$post({ param: { id }, json: { userId } })),
      removeManager: (id: string, userId: string) =>
        unwrap(c.colonies[":id"].managers[":userId"].$delete({ param: { id, userId } })),
    },
    cats: {
      list: (query: CatListQuery = {}) => unwrap(c.cats.$get({ query: toQuery(query) })),
      get: (id: string) => unwrap(c.cats[":id"].$get({ param: { id } })),
      create: (json: Body<RawClient["cats"]["$post"]>) => unwrap(c.cats.$post({ json })),
      update: (id: string, json: Body<RawClient["cats"][":id"]["$put"]>) =>
        unwrap(c.cats[":id"].$put({ param: { id }, json })),
      delete: (id: string) => unwrap(c.cats[":id"].$delete({ param: { id } })),
      propose: (id: string, json: Body<RawClient["cats"][":id"]["proposals"]["$post"]>) =>
        unwrap(c.cats[":id"].proposals.$post({ param: { id }, json })),
      /** URL of the main photo; `version` (e.g. updatedAt) busts the browser cache. */
      photoUrl: (id: string, version?: string) =>
        `${base}/cats/${id}/photo${version ? `?v=${encodeURIComponent(version)}` : ""}`,
      /**
       * Uploads a photo and returns the `photoKey` to send with the cat. Browsers pass a
       * `Blob`/`File`; React Native passes the picked image's `{ uri, name, type }`.
       */
      uploadPhoto: async (file: Blob | NativeFile): Promise<{ photoKey: string }> => {
        const form = new FormData();
        form.append("file", file as Blob);
        const headers = (await options.headers?.()) ?? {};
        return unwrap(
          doFetch(`${base}/uploads/photos`, {
            method: "POST",
            body: form,
            headers,
            credentials: "include",
          }) as unknown as Promise<ClientResponse<{ photoKey: string }>>,
        );
      },
    },
    actions: {
      list: (query: Partial<ActionListQuery> = {}) =>
        unwrap(c.actions.$get({ query: toQuery(query) })),
      catOptions: () => unwrap(c.actions["cat-options"].$get()),
      get: (id: string) => unwrap(c.actions[":id"].$get({ param: { id } })),
      create: (json: Body<RawClient["actions"]["$post"]>) => unwrap(c.actions.$post({ json })),
      update: (id: string, json: Body<RawClient["actions"][":id"]["$put"]>) =>
        unwrap(c.actions[":id"].$put({ param: { id }, json })),
      setStatus: (id: string, status: ActionStatus) =>
        unwrap(c.actions[":id"].status.$patch({ param: { id }, json: { status } })),
      delete: (id: string) => unwrap(c.actions[":id"].$delete({ param: { id } })),
      setValidation: (id: string, validated: boolean) =>
        unwrap(c.actions[":id"].validation.$put({ param: { id }, json: { validated } })),
    },
    proposals: {
      list: (query: { status?: ProposalStatus; colonyId?: string; catId?: string } = {}) =>
        unwrap(c.proposals.$get({ query: toQuery(query) })),
      resolve: (id: string, json: Body<RawClient["proposals"][":id"]["resolve"]["$post"]>) =>
        unwrap(c.proposals[":id"].resolve.$post({ param: { id }, json })),
      withdraw: (id: string) => unwrap(c.proposals[":id"].withdraw.$post({ param: { id } })),
    },
    deletions: {
      list: (query: { status?: DeletionStatus } = {}) =>
        unwrap(c["deletion-requests"].$get({ query: toQuery(query) })),
      request: (json: Body<RawClient["deletion-requests"]["$post"]>) =>
        unwrap(c["deletion-requests"].$post({ json })),
      resolve: (
        id: string,
        json: Body<RawClient["deletion-requests"][":id"]["resolve"]["$post"]>,
      ) => unwrap(c["deletion-requests"][":id"].resolve.$post({ param: { id }, json })),
      withdraw: (id: string) =>
        unwrap(c["deletion-requests"][":id"].withdraw.$post({ param: { id } })),
    },
    dashboard: {
      get: () => unwrap(c.dashboard.$get()),
    },
    admin: {
      organizations: (query: OrganizationListQuery = {}) =>
        unwrap(c.admin.organizations.$get({ query: toQuery(query) })),
      organization: (id: string) => unwrap(c.admin.organizations[":id"].$get({ param: { id } })),
      review: (
        id: string,
        json: Body<RawClient["admin"]["organizations"][":id"]["review"]["$post"]>,
      ) => unwrap(c.admin.organizations[":id"].review.$post({ param: { id }, json })),
      invite: (
        id: string,
        json: Body<RawClient["admin"]["organizations"][":id"]["invitations"]["$post"]>,
      ) => unwrap(c.admin.organizations[":id"].invitations.$post({ param: { id }, json })),
      createTownHall: (json: Body<RawClient["admin"]["town-halls"]["$post"]>) =>
        unwrap(c.admin["town-halls"].$post({ json })),
    },
  };
}

export type Api = ReturnType<typeof createApi>;

/** Resolved response type of an API method, e.g. `ApiData<Api["cats"]["get"]>`. */
export type ApiData<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;
