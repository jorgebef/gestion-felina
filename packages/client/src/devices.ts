/** Readable description of the device behind a session (sessions lists on web and mobile). */

/** "Chrome en macOS" from a user agent string (good enough to recognise a device). */
export function describeDevice(userAgent: string | null | undefined): {
  label: string;
  mobile: boolean;
} {
  const ua = userAgent ?? "";
  if (!ua) return { label: "Dispositivo desconocido", mobile: false };
  // The mobile app's requests (React Native networking).
  if (/okhttp/i.test(ua)) return { label: "App en Android", mobile: true };
  if (/CFNetwork|Darwin/.test(ua) && !/Mozilla/.test(ua))
    return { label: "App en iOS", mobile: true };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return {
    label: os ? `${browser} en ${os}` : browser,
    mobile: /Mobi|iPhone|Android/.test(ua),
  };
}
