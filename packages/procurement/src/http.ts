const USER_AGENT = "LicitaMVP/0.1 (+ingesta de datos abiertos de contratación pública)";

/** GET with timeout and bounded exponential backoff on network errors and 5xx/429. */
export async function fetchText(
  url: string,
  { attempts = 3, timeoutMs = 120_000 }: { attempts?: number; timeoutMs?: number } = {},
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml, application/xml" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return await response.text();
      lastError = new Error(`HTTP ${response.status} fetching ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
