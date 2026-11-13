// Client fetch for server functions (wired in start.ts via serverFns.fetch):
// 1) adds x-amz-content-sha256 (CloudFront OAC -> Lambda URL requires the body hash on POST/PUT);
// 2) retries 429/503/504 and network errors, 3 attempts total, exponential backoff + jitter.
//    4xx validation errors and aborts are never retried.
import { sha256Hex } from "./sha256";

const RETRYABLE = new Set([429, 503, 504]);
const MAX_ATTEMPTS = 3;

export async function withBodyHash(input: RequestInfo | URL, init: RequestInit = {}): Promise<RequestInit> {
  const method = (init.method ?? "GET").toUpperCase();
  if (init.body == null || method === "GET" || method === "HEAD") return init;
  const headers = new Headers(init.headers);
  let body: BodyInit = init.body;
  let bytes: Uint8Array;
  if (typeof body === "string") {
    bytes = new TextEncoder().encode(body);
  } else {
    // FormData / Blob / etc.: materialize once so the hash matches the bytes actually sent.
    const req = new Request(input instanceof Request ? input.url : String(input), { method, headers, body });
    bytes = new Uint8Array(await req.arrayBuffer());
    const ct = req.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
    body = bytes as unknown as BodyInit;
  }
  headers.set("x-amz-content-sha256", sha256Hex(bytes));
  return { ...init, headers, body };
}

function sleep(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
}

// attempt 1 -> ~300-600 ms, attempt 2 -> ~600-1200 ms (equal jitter).
const backoff = (attempt: number) => { const base = 600 * 2 ** (attempt - 1); return base / 2 + Math.random() * (base / 2); };

export async function rpcFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const prepared = await withBodyHash(input, init);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(input, prepared);
      if (!RETRYABLE.has(res.status) || attempt >= MAX_ATTEMPTS) return res;
    } catch (e) {
      if (prepared.signal?.aborted || (e as Error)?.name === "AbortError" || attempt >= MAX_ATTEMPTS) throw e;
    }
    await sleep(backoff(attempt), prepared.signal);
  }
}
