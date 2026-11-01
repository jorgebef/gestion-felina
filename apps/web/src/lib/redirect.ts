/** Only allow same-site relative paths as post-login destinations. */
export function safeRedirect(target: string | undefined, fallback = "/panel"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return target;
}
