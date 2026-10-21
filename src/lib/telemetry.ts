// Tiny client telemetry: queue + sendBeacon to /api/t (flush every 10 s / on hide). No PII.
type Evt = Record<string, string | number | boolean | null | undefined>;
const q: Evt[] = [];
let started = false;

export const sessionId: string =
  typeof window === "undefined"
    ? ""
    : (sessionStorage.getItem("helion-sid") ??
      (() => { const v = Math.random().toString(36).slice(2, 12); sessionStorage.setItem("helion-sid", v); return v; })());

export function track(tipo: string, props: Evt = {}) {
  if (typeof window === "undefined") return;
  q.push({ tipo, sessionId, route: location.pathname + (location.search ? "?" : ""), t: Date.now(), ...props });
  if (q.length >= 20) flush();
}

function flush() {
  if (!q.length) return;
  const body = JSON.stringify({ e: q.splice(0, 20) });
  try {
    if (!navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch { /* ignore */ }
}

export function initTelemetry() {
  if (started || typeof window === "undefined") return;
  started = true;
  setInterval(flush, 10_000);
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  addEventListener("error", (e) => track("error_client", { msg: String(e.message).slice(0, 200) }));
  addEventListener("unhandledrejection", (e) => track("error_client", { msg: String((e as PromiseRejectionEvent).reason?.message ?? e.reason).slice(0, 200) }));
  track("pageview", { ref: document.referrer ? new URL(document.referrer).host : "" });
}
