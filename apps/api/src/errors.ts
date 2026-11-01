import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { DomainError, type ErrorCode } from "@licita/core/context";

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  UNAUTHORIZED: 401,
  NO_COMPANY: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Body of every error response: `{ "error": { "code": "NOT_FOUND", "message": "…" } }`. */
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}

export function errorResponse(c: Context, code: ErrorCode, message: string = code) {
  return c.json({ error: { code, message } } satisfies ApiErrorBody, STATUS[code]);
}

export function handleError(error: Error, c: Context) {
  if (error instanceof DomainError) return errorResponse(c, error.code, error.message);
  if (error instanceof HTTPException) {
    if (error.status === 413) return errorResponse(c, "VALIDATION", "Petición demasiado grande");
    return error.getResponse();
  }
  console.error(`[api] ${c.req.method} ${c.req.path} failed`, error);
  return errorResponse(c, "INTERNAL", "Error interno");
}
