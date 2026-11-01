/**
 * Same-origin proxy to the API (apps/api): the browser only ever talks to this origin,
 * so the Better Auth session cookie stays first-party and no CORS is involved. In
 * production a load balancer can route /api/* to the API directly instead.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";

import { apiOrigin } from "@/lib/api-origin";

// Hop-by-hop headers, and headers that no longer describe a body fetch() decoded.
const DROPPED_REQUEST_HEADERS = ["host", "connection", "content-length", "transfer-encoding"];
const DROPPED_RESPONSE_HEADERS = [
  "connection",
  "content-encoding",
  "content-length",
  "transfer-encoding",
];

async function proxy({ request }: { request: Request }): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, apiOrigin());

  const headers = new Headers(request.headers);
  for (const name of DROPPED_REQUEST_HEADERS) headers.delete(name);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  // Lets the API rate-limit per visitor. Set TRUST_PROXY=true when this app itself runs
  // behind a load balancer that sets X-Forwarded-For.
  const ip = getRequestIP({ xForwardedFor: process.env.TRUST_PROXY === "true" });
  if (ip) headers.set("x-forwarded-for", ip);
  else headers.delete("x-forwarded-for");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch (error) {
    console.error(`[api-proxy] ${request.method} ${target.pathname} failed`, error);
    return Response.json(
      { error: { code: "INTERNAL", message: "La API no está disponible" } },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) responseHeaders.delete(name);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: proxy, POST: proxy, PUT: proxy, PATCH: proxy, DELETE: proxy },
  },
});
