import { ApiError } from "@felina/api-client";

/** User-facing message for errors returned by the API. */
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === "UNAUTHORIZED") return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (code === "NO_ORGANIZATION") return "Primero tienes que unirte a una organización.";
  if (code === "ORGANIZATION_NOT_APPROVED") return "Tu organización todavía no está aprobada.";
  if (
    code === "FORBIDDEN" ||
    code === "NOT_FOUND" ||
    code === "VALIDATION" ||
    code === "CONFLICT"
  ) {
    return (error as ApiError).message;
  }
  if (code === "RATE_LIMITED") return "Demasiados intentos. Espera un minuto.";
  if (code === "NETWORK") return "No hay conexión con el servidor. Inténtalo de nuevo.";
  return "Ha ocurrido un error. Inténtalo de nuevo en unos segundos.";
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === "NOT_FOUND";
}
