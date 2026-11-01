/** Server-side address of the API (apps/api). Never sent to the browser. */
export function apiOrigin(): string {
  return process.env.API_URL?.trim() || "http://localhost:3001";
}
