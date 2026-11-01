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

/** User-facing message for Better Auth error codes (sign-in, sign-up, passwords, sessions). */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email o contraseña incorrectos.";
    case "INVALID_PASSWORD":
      return "La contraseña actual no es correcta.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya existe una cuenta con este email. Inicia sesión.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "La contraseña no puede tener más de 128 caracteres.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "Tu cuenta no tiene contraseña. Pide un enlace para crearla.";
    case "SESSION_EXPIRED":
      return "Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.";
    case "TOO_MANY_REQUESTS":
      return "Demasiados intentos. Espera un minuto.";
    default:
      return "No hemos podido completar la operación. Inténtalo de nuevo.";
  }
}
