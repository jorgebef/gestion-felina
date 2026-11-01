import type { FetchOptions, SourceConnector, SourcePage } from "../types.ts";

import { fetchText } from "../http.ts";
import { parseFeed } from "./parser.ts";

/**
 * Official PLACSP feed "Licitaciones publicadas en la Plataforma de Contratación del
 * Sector Público" (sindicación 643). Newest changes come first; each page links to the
 * previous one with rel="next", so an incremental run walks pages until it reaches
 * entries already imported.
 */
export const PLACSP_FEED_URL =
  "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom";

export function placspConnector(
  options: { feedUrl?: string; fetchDocument?: (url: string) => Promise<string> } = {},
): SourceConnector {
  const fetchDocument = options.fetchDocument ?? ((url: string) => fetchText(url));
  const defaultUrl = options.feedUrl ?? PLACSP_FEED_URL;
  return {
    id: "placsp_direct",
    label: "Plataforma de Contratación del Sector Público",
    defaultUrl,
    async *pages({ since, maxPages, startUrl }: FetchOptions): AsyncIterable<SourcePage> {
      let url: string | undefined = startUrl ?? defaultUrl;
      const visited = new Set<string>();
      for (let page = 0; url && page < maxPages && !visited.has(url); page++) {
        visited.add(url);
        const body = await fetchDocument(url);
        const parsed = parseFeed(body);
        yield {
          url,
          raw: { body, contentType: "application/atom+xml", extension: "atom" },
          ...parsed,
        };
        if (since && parsed.oldestUpdatedAt && parsed.oldestUpdatedAt <= since) return;
        url = parsed.nextUrl;
      }
    },
  };
}
