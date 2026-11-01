import { ApiError } from "@licita/api-client";

/** User-facing message for errors returned by the API. */
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  if (code === "UNAUTHORIZED") return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (code === "NO_COMPANY") return "Primero tienes que crear tu empresa.";
  if (code === "FORBIDDEN") return "No tienes permiso para hacer esto.";
  if (code === "NOT_FOUND") return "No hemos encontrado lo que buscas.";
  if (code === "VALIDATION") return (error as ApiError).message;
  if (code === "RATE_LIMITED") return "Demasiados intentos. Espera un minuto.";
  if (code === "NETWORK") return "No hay conexión con el servidor. Inténtalo de nuevo.";
  return "Ha ocurrido un error. Inténtalo de nuevo en unos segundos.";
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === "NOT_FOUND";
}
