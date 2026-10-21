import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { clientIp, eventsBatch, hashIp } from "./lib/backend.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

const ORIGIN_SECRET = process.env.ORIGIN_SECRET;

// POST /api/t — batched client telemetry (sendBeacon). Max 16 KB, 20 events.
async function telemetry(request: Request): Promise<Response> {
  const text = (await request.text()).slice(0, 16_384);
  try {
    const body = JSON.parse(text);
    const evts = (Array.isArray(body?.e) ? body.e : []).filter((e: unknown) => e && typeof e === "object");
    const ip = hashIp(clientIp((n) => request.headers.get(n)));
    await eventsBatch(evts, ip, request.headers.get("user-agent") ?? "");
  } catch { /* ignore malformed */ }
  return new Response(null, { status: 204 });
}

function withCacheHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/_serverFn")) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const h = new Headers(response.headers);
  // HTML is identical for everyone: let CloudFront cache it briefly; browsers always revalidate.
  h.set("cache-control", response.status === 200
    ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
    : "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (ORIGIN_SECRET && request.headers.get("x-origin-verify") !== ORIGIN_SECRET) {
        return new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } });
      }
      const url = new URL(request.url);
      if (url.pathname === "/api/t") {
        return request.method === "POST" ? await telemetry(request) : new Response(null, { status: 405 });
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withCacheHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
