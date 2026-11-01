/**
 * Typed client for the Licita API (`/api/v1`). Request and response types come from
 * the Hono routes in apps/api, so a change there is a type error here and in every
 * caller. Dates arrive as ISO strings, exactly as they travel over JSON.
 *
 *   const api = createApi({ baseUrl: "https://app.example.es" });
 *   const { items } = await api.tenders.search({ q: "limpieza" });
 */
import { hc, type ClientResponse, type InferRequestType } from "hono/client";

import type { ApiRoutes } from "@licita/api";
import type { WorkflowStatusValue } from "@licita/domain/tenders";
import type { MatchListQuery } from "@licita/schemas/matches";
import type { TenderSearch } from "@licita/schemas/tender-search";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NO_COMPANY"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
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

export function createApi(options: ApiOptions) {
  const c: RawClient = createRawClient(options);
  return {
    public: {
      stats: () => unwrap(c.public.stats.$get()),
      authConfig: () => unwrap(c.public["auth-config"].$get()),
    },
    me: {
      /** Signed-in user and active company, or null when anonymous. */
      get: () => unwrap(c.me.$get()),
      update: (json: Json<InferRequestType<RawClient["me"]["$patch"]>>) =>
        unwrap(c.me.$patch({ json })),
    },
    companies: {
      create: (json: Json<InferRequestType<RawClient["companies"]["$post"]>>) =>
        unwrap(c.companies.$post({ json })),
      current: () => unwrap(c.companies.current.$get()),
      updateCurrent: (json: Json<InferRequestType<RawClient["companies"]["current"]["$patch"]>>) =>
        unwrap(c.companies.current.$patch({ json })),
    },
    alertProfiles: {
      list: () => unwrap(c["alert-profiles"].$get()),
      get: (id: string) => unwrap(c["alert-profiles"][":id"].$get({ param: { id } })),
      create: (json: Json<InferRequestType<RawClient["alert-profiles"]["$post"]>>) =>
        unwrap(c["alert-profiles"].$post({ json })),
      update: (
        id: string,
        json: Json<InferRequestType<RawClient["alert-profiles"][":id"]["$put"]>>,
      ) => unwrap(c["alert-profiles"][":id"].$put({ param: { id }, json })),
      setActive: (id: string, isActive: boolean) =>
        unwrap(c["alert-profiles"][":id"].active.$patch({ param: { id }, json: { isActive } })),
      delete: (id: string) => unwrap(c["alert-profiles"][":id"].$delete({ param: { id } })),
    },
    cpv: {
      search: (q: string) => unwrap(c.cpv.$get({ query: { q } })),
      suggest: (json: Json<InferRequestType<RawClient["cpv"]["suggestions"]["$post"]>>) =>
        unwrap(c.cpv.suggestions.$post({ json })),
    },
    tenders: {
      search: (search: TenderSearch) => unwrap(c.tenders.$get({ query: toQuery(search) })),
      get: (id: string) => unwrap(c.tenders[":id"].$get({ param: { id } })),
      tracking: (id: string) => unwrap(c.tenders[":id"].tracking.$get({ param: { id } })),
      track: (id: string) => unwrap(c.tenders[":id"].tracking.$put({ param: { id } })),
      untrack: (id: string) => unwrap(c.tenders[":id"].tracking.$delete({ param: { id } })),
    },
    authorities: {
      search: (q: string) => unwrap(c.authorities.$get({ query: { q } })),
    },
    imports: {
      latest: () => unwrap(c.imports.latest.$get()),
    },
    tracked: {
      list: (filter: { status?: WorkflowStatusValue }) =>
        unwrap(c.tracked.$get({ query: toQuery(filter) })),
      update: (id: string, json: Json<InferRequestType<RawClient["tracked"][":id"]["$patch"]>>) =>
        unwrap(c.tracked[":id"].$patch({ param: { id }, json })),
      createTask: (
        id: string,
        json: Json<InferRequestType<RawClient["tracked"][":id"]["tasks"]["$post"]>>,
      ) => unwrap(c.tracked[":id"].tasks.$post({ param: { id }, json })),
    },
    tasks: {
      setCompleted: (id: string, completed: boolean) =>
        unwrap(c.tasks[":id"].$patch({ param: { id }, json: { completed } })),
      delete: (id: string) => unwrap(c.tasks[":id"].$delete({ param: { id } })),
    },
    dashboard: {
      get: () => unwrap(c.dashboard.$get()),
    },
    matches: {
      list: (filter: MatchListQuery) => unwrap(c.matches.$get({ query: toQuery(filter) })),
      setFeedback: (id: string, feedback: "relevant" | "irrelevant" | null) =>
        unwrap(c.matches[":id"].feedback.$patch({ param: { id }, json: { feedback } })),
    },
    notifications: {
      list: () => unwrap(c.notifications.$get()),
      sendTest: () => unwrap(c.notifications.test.$post()),
    },
  };
}

export type Api = ReturnType<typeof createApi>;

/** Resolved response type of an API method, e.g. `ApiData<Api["tenders"]["get"]>`. */
export type ApiData<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;
