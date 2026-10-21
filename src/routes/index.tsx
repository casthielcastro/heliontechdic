import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { humanize, deepDive, enviarNota, reportarErro } from "@/lib/helion.functions";
import helionLogo from "@/assets/helion-logo.webp";
import { track, sessionId, initTelemetry } from "@/lib/telemetry";

export const Route = createFileRoute("/")({
  component: Helion,
});

/* ---------- DESIGN TOKENS — Obsidian Premium ---------- */
const C = {
  bg: "#050505",
  bgSoft: "#0A0A0B",
  surface: "rgba(255,255,255,0.03)",
  surfaceHi: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.06)",
  borderAmber: "rgba(245,158,11,0.15)",
  borderAmberHi: "rgba(245,158,11,0.55)",
  text: "#F5F5F7",
  textMd: "#A1A1AA",
  textLt: "rgba(245,245,247,0.68)",
  textXLt: "rgba(245,245,247,0.64)",
  amber: "#F59E0B",
  amberHi: "#FBBF24",
  amberSoft: "rgba(245,158,11,0.08)",
  amberGlow: "0 0 24px rgba(245,158,11,0.35)",
  danger: "#EF4444",
};

const FONT_DISPLAY = `'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif`;
const FONT_BODY = `'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif`;
const FONT_MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`;

/* ---------- HELPFULNESS SCALE ---------- */
const SCALE: { value: number; phrase: string; icon: string }[] = [
  { value: 0, phrase: "Continuo no breu", icon: "🌑" },
  { value: 25, phrase: "Vejo uma pequena luz", icon: "🕯️" },
  { value: 50, phrase: "Um pé pra fora da caverna", icon: "🚪" },
  { value: 75, phrase: "Platão que se vire, eu tô indo embora dessa caverna", icon: "🏃" },
  { value: 100, phrase: "TO-TAL-MEN-TE ILUMINADO(A)", icon: "☀️" },
];

const DEEP_MSGS = ["Abrindo o compêndio…", "Buscando exemplos reais…", "Montando analogias…", "Separando boas referências…"];
const LOADING_MSGS = [
  "Lendo o termo…",
  "Acendendo a lanterna…",
  "Procurando a melhor analogia…",
  "Traduzindo do técnico para o humano…",
  "Quase lá, polindo a explicação…",
];

function useRotating(active: boolean, msgs = LOADING_MSGS, ms = 1800) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) { setI(0); return; }
    const t = setInterval(() => setI((x) => (x + 1) % msgs.length), ms);
    return () => clearInterval(t);
  }, [active, msgs, ms]);
  return msgs[i];
}

function withTimeout<T>(p: Promise<T>, ms = 30000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("A resposta demorou mais que o esperado. Tente novamente.")), ms)),
  ]);
}

function friendly(e: unknown, fallback = "Algo deu errado. Tente novamente em instantes.") {
  const m = (e as Error)?.message ?? "";
  if (!m || /^\[|^\{|zod|invalid_|Failed to fetch|NetworkError/i.test(m)) {
    return /fetch|network/i.test(m) ? "Sem conexão com o servidor. Verifique sua internet e tente de novo." : fallback;
  }
  return m.slice(0, 200);
}

/** Downscale to ≤1568px JPEG (q .8) so uploads stay small (Bedrock tokens + Lambda 6 MB limit). */
async function prepareImage(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error("Formato não suportado. Use PNG, JPG, WEBP ou GIF.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 15 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Não consegui ler essa imagem.")); i.src = url;
    });
    const scale = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = 0.8, out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 1_400_000 && q > 0.4) { q -= 0.15; out = canvas.toDataURL("image/jpeg", q); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

function Spinner({ small }: { small?: boolean }) {
  const sz = small ? 16 : 28;
  return (
    <div aria-hidden style={{ position: "relative", width: sz, height: sz, flex: "0 0 auto" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `2px solid ${C.border}`,
          borderTopColor: C.amber,
          animation: "spin 0.9s linear infinite",
        }}
      />
    </div>
  );
}

/* ---------- TYPES ---------- */
type Mode = "casual" | "tecnica";
type Length = "curta" | "longa";
type Analise = "padrao" | "codigo";

/* ---------- MAIN ---------- */
function Helion() {
  const [termo, setTermo] = useState("");
  const [wantImage, setWantImage] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageErr, setImageErr] = useState<string | null>(null);
  const [modo, setModo] = useState<Mode>("casual");
  const [tamanho, setTamanho] = useState<Length>("curta");
  const [analise, setAnalise] = useState<Analise>("padrao");
  const [loading, setLoading] = useState(false);
  const [resposta, setRespostaState] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [foraEscopo, setForaEscopo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deepTermoUrl, setDeepTermoUrl] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const loadingMsg = useRotating(loading);

  const callHumanize = useServerFn(humanize);
  const callNota = useServerFn(enviarNota);

  useEffect(() => { initTelemetry(); }, []);

  // Compêndio has its own URL (?compendio=termo) so the phone's Back button closes it.
  useEffect(() => {
    const sync = () => setDeepTermoUrl(new URLSearchParams(location.search).get("compendio"));
    sync();
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  const openDeep = (t: string) => {
    track("click", { nome: "compendio" });
    history.pushState({ compendio: 1 }, "", `/?compendio=${encodeURIComponent(t)}`);
    setDeepTermoUrl(t);
  };
  const closeDeep = () => {
    if (history.state?.compendio) history.back();
    else { history.replaceState(null, "", "/"); setDeepTermoUrl(null); }
  };

  const codeNeedsImage = analise === "codigo" && !imageDataUrl;
  const hasInput = termo.trim().length > 0 || !!imageDataUrl;
  const canSubmit = hasInput && !codeNeedsImage && !loading && termo.length <= 200;

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setImageErr(null);
    try {
      const data = await prepareImage(file);
      setWantImage(true);
      setImageDataUrl(data);
      setImageName(file.name || "imagem colada");
      track("click", { nome: "upload", kb: Math.round(data.length / 1365) });
    } catch (e) {
      setImageErr(friendly(e));
    }
  }, []);

  // Ctrl+V / Cmd+V pastes a screenshot from anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) { e.preventDefault(); handleFile(f); }
    };
    addEventListener("paste", onPaste);
    return () => removeEventListener("paste", onPaste);
  }, [handleFile]);

  const clearImage = () => { setImageDataUrl(null); setImageName(null); setImageErr(null); if (fileRef.current) fileRef.current.value = ""; };

  const toggleImage = (on: boolean) => {
    setWantImage(on);
    if (!on) { clearImage(); if (analise === "codigo") setAnalise("padrao"); }
  };

  const chooseAnalise = (a: Analise) => {
    setAnalise(a);
    if (a === "codigo") setWantImage(true);
  };

  const reset = () => {
    setTermo(""); clearImage(); setWantImage(false);
    setRespostaState(null); setForaEscopo(false); setErro(null); setHint(null);
    setScore(null); setCopied(false);
  };

  const submit = async () => {
    if (!hasInput) { setHint("Digite um termo (ou adicione uma imagem) para começar."); return; }
    if (codeNeedsImage) { setHint("A análise de código precisa de uma imagem do código."); return; }
    if (!canSubmit) return;
    setHint(null); setLoading(true); setRespostaState(null); setForaEscopo(false); setErro(null); setScore(null); setCopied(false);
    track("click", { nome: "humanizar", modo, tamanho, analise, img: !!imageDataUrl });
    const t0 = performance.now();
    try {
      const out = await withTimeout(callHumanize({ data: { termo: termo.trim(), modo, tamanho, imageDataUrl, analise, sessionId } }));
      setRequestId(out.requestId);
      if (out.foraDeEscopo) setForaEscopo(true);
      else setRespostaState(out.texto);
      track("ai_ok", { ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setErro(friendly(e));
      track("error_ai", { msg: String((e as Error)?.message).slice(0, 120) });
    } finally {
      setLoading(false);
      setTimeout(() => resultRef.current?.focus(), 50);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const copy = async () => {
    if (!resposta) return;
    try { await navigator.clipboard.writeText(resposta.replace(/\*\*/g, "")); setCopied(true); track("click", { nome: "copiar" }); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  // Every rating is stored (debounced 800 ms after the last change).
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onScore = (v: number) => {
    setScore(v);
    clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => {
      callNota({ data: { score: v, termo: termo.slice(0, 200), modo, tamanho, analise, requestId, sessionId } }).catch(() => {});
    }, 800);
  };

  /* ---- styles ---- */
  const pageBg: CSSProperties = { minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: FONT_BODY, position: "relative", overflowX: "hidden", paddingBottom: 80 };
  const container: CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "32px 20px 64px", position: "relative", zIndex: 1 };
  const glassCard: CSSProperties = { background: C.surface, borderRadius: 16, padding: "clamp(20px, 5vw, 32px)", border: `1px solid ${C.border}`, animation: "fadeUp 0.45s ease both" };
  const labelStyle: CSSProperties = { fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em", color: C.textLt, textTransform: "uppercase", marginBottom: 10, display: "block", fontWeight: 500 };
  const textareaStyle: CSSProperties = {
    width: "100%", minHeight: 72, background: "rgba(255,255,255,0.02)", border: `1px solid ${termo ? C.borderAmberHi : "rgba(255,255,255,0.18)"}`,
    borderRadius: 12, padding: "14px 16px", fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.5, color: C.text, resize: "vertical",
    transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box", boxShadow: termo ? `0 0 0 3px ${C.amberSoft}` : "none",
  };

  const deepTermo = (() => {
    if (deepTermoUrl) return deepTermoUrl;
    return null;
  })();
  const langMatch = analise === "codigo" && resposta ? resposta.match(/Linguagem detectada:\*\*\s*([^\n*]+)/i) : null;
  const deepFromResult = langMatch?.[1]?.trim() || termo.trim() || "imagem enviada";

  return (
    <div style={pageBg}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes overlayIn { from { opacity:0 } to { opacity:1 } }
        @keyframes shimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
        * { box-sizing: border-box; }
        html, body { background: ${C.bg}; }
        ::placeholder { color: ${C.textLt}; opacity: 1; }
        textarea, input { outline: none; }
        textarea:focus, input[type=text]:focus { border-color: ${C.borderAmberHi} !important; box-shadow: 0 0 0 3px ${C.amberSoft} !important; }
        :focus-visible { outline: 2px solid ${C.amberHi} !important; outline-offset: 2px; }
        a:hover { color: ${C.amberHi}; }
        .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0; }
        .opt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 440px) { .opt-grid { grid-template-columns: 1fr; } }
        .skel { border-radius: 6px; height: 12px; margin: 10px 0; background: linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.04) 80px); background-size: 800px 100%; animation: shimmer 1.4s infinite linear; }
        .helion-primary:hover:not(:disabled) { box-shadow: ${C.amberGlow}; border-color: ${C.amber}; }
        .helion-ghost:hover { background: ${C.amberSoft}; border-color: ${C.amber}; color: ${C.amberHi}; }
        input[type=range].helion-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; background: rgba(255,255,255,0.14); border-radius: 999px; }
        input[type=range].helion-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: ${C.amber}; cursor: pointer; box-shadow: 0 0 0 4px rgba(245,158,11,0.15), 0 0 16px rgba(245,158,11,0.5); border: none; }
        input[type=range].helion-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: ${C.amber}; cursor: pointer; border: none; box-shadow: 0 0 0 4px rgba(245,158,11,0.15), 0 0 16px rgba(245,158,11,0.5); }
        input[type=range].helion-slider.neutral::-webkit-slider-thumb { background: #52525b; box-shadow: none; }
        input[type=range].helion-slider.neutral::-moz-range-thumb { background: #52525b; box-shadow: none; }
      `}</style>

      <main style={container} aria-hidden={deepTermo ? true : undefined}>
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ margin: 0 }}>
            <img src={helionLogo} alt="HELION — Traduzindo o técnico, iluminando o humano." width={1120} height={610}
              fetchPriority="high"
              style={{ display: "block", width: "100%", maxWidth: 560, height: "auto", margin: "0 auto", userSelect: "none" }} />
          </h1>
          <p style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 15, margin: "12px 0 0" }}>
            Digite um termo de tecnologia e receba uma explicação humana, em português.
          </p>
        </header>

        <section style={glassCard} aria-label="Nova consulta">
          <div>
            <label htmlFor="termo" style={labelStyle}>Termo, sigla ou expressão</label>
            <textarea id="termo" value={termo} maxLength={200}
              onChange={(e) => { setTermo(e.target.value); setHint(null); }}
              onKeyDown={onKey} placeholder="Ex.: API REST, machine learning, latência, Docker…" rows={2} style={textareaStyle}
              aria-describedby="termo-help" />
            <div id="termo-help" style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 12, color: C.textLt, marginTop: 6 }}>
              <span>Enter envia · Shift+Enter quebra linha</span>
              <span>{termo.length}/200</span>
            </div>
          </div>

          {/* IMAGE TOGGLE — upload hidden until the user asks for it */}
          <label style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14, color: C.text, minHeight: 44 }}>
            <input type="checkbox" checked={wantImage} onChange={(e) => toggleImage(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: C.amber, cursor: "pointer" }} aria-controls="upload-zone" />
            Também quero adicionar uma imagem complementar
          </label>

          {wantImage && (
            <div id="upload-zone">
              <div role="button" tabIndex={0} aria-label={imageDataUrl ? `Imagem anexada: ${imageName}. Pressione Enter para trocar.` : "Escolher imagem (PNG, JPG, WEBP ou GIF). Você também pode arrastar ou colar com Ctrl+V."}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  marginTop: 8, padding: imageDataUrl ? 10 : 16, minHeight: 56,
                  border: `1px dashed ${imageDataUrl ? C.amber : dragOver ? C.amberHi : "rgba(255,255,255,0.25)"}`, borderRadius: 12,
                  background: imageDataUrl ? C.amberSoft : "rgba(255,255,255,0.02)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  justifyContent: imageDataUrl ? "flex-start" : "center", fontFamily: FONT_BODY, fontSize: 14, color: imageDataUrl ? C.amberHi : C.textMd, textAlign: "center",
                }}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden tabIndex={-1}
                  onChange={(e) => handleFile(e.target.files?.[0])} />
                {imageDataUrl ? (
                  <>
                    <img src={imageDataUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.amber}` }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{imageName}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); clearImage(); }} aria-label="Remover imagem"
                      style={{ background: "transparent", border: "none", color: C.amber, cursor: "pointer", fontSize: 18, minWidth: 44, minHeight: 44 }}>✕</button>
                  </>
                ) : (
                  <span>📎 Clique, arraste ou cole (Ctrl+V) um print · PNG, JPG, WEBP</span>
                )}
              </div>
              {imageErr && <p role="alert" style={{ color: "#FCA5A5", fontSize: 13, margin: "8px 0 0" }}>{imageErr}</p>}
            </div>
          )}

          <OptionGroup label="Tom da explicação" value={modo} onChange={(v) => setModo(v as Mode)} options={[
            { value: "casual", label: "Casual", desc: "Sem formalidades, para qualquer pessoa" },
            { value: "tecnica", label: "Técnica", desc: "Termos precisos, para quem é da área" },
          ]} />
          <OptionGroup label="Tamanho da resposta" value={tamanho} onChange={(v) => setTamanho(v as Length)} options={[
            { value: "curta", label: "Curta", desc: "Definição direta, até 3 parágrafos" },
            { value: "longa", label: "Longa", desc: "Aprofundada, com exemplos e contexto" },
          ]} />
          <OptionGroup label="Tipo de análise" value={analise} onChange={(v) => chooseAnalise(v as Analise)} options={[
            { value: "padrao", label: "Explicar termo", desc: "Termos, siglas e expressões (com ou sem imagem)" },
            { value: "codigo", label: "Explicar código (imagem)", desc: "Detecta a linguagem e explica linha a linha" },
          ]} />
          {codeNeedsImage && (
            <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.amberHi, marginTop: 10 }}>
              Adicione acima um print do código para usar este modo.
            </p>
          )}

          <button type="button" onClick={submit} aria-disabled={!canSubmit} aria-busy={loading} className="helion-primary"
            style={{
              marginTop: 28, width: "100%", padding: "15px 24px", minHeight: 48, borderRadius: 12,
              border: `1px solid ${canSubmit ? C.borderAmberHi : C.border}`, cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: "0.14em",
              color: canSubmit ? C.amber : C.textLt, background: "rgba(245,158,11,0.06)", transition: "all 0.2s ease", textTransform: "uppercase",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
            {loading ? (<><Spinner small /> Iluminando…</>) : "Humanizar"}
          </button>
          <p aria-live="polite" style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.amberHi, textAlign: "center", marginTop: 10, minHeight: 18 }}>{hint}</p>
        </section>

        <div ref={resultRef} tabIndex={-1} aria-live="polite" aria-busy={loading} style={{ outline: "none" }}>
          {loading && (
            <div style={{ ...glassCard, marginTop: 20 }} role="status">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Spinner />
                <span style={{ fontFamily: FONT_MONO, color: C.textMd, fontSize: 13 }}>{loadingMsg}</span>
              </div>
              <div className="skel" style={{ width: "92%" }} />
              <div className="skel" style={{ width: "100%" }} />
              <div className="skel" style={{ width: "78%" }} />
              <div className="skel" style={{ width: "85%" }} />
            </div>
          )}

          {foraEscopo && !loading && (
            <div style={{ ...glassCard, marginTop: 20, borderColor: C.borderAmberHi }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.amber, letterSpacing: "0.12em", marginBottom: 6 }}>FORA DE ESCOPO</div>
              <h2 style={{ fontFamily: FONT_DISPLAY, color: C.text, fontSize: 20, margin: "4px 0 12px", fontWeight: 600 }}>Esse termo não parece ser de tecnologia.</h2>
              <p style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 15, lineHeight: 1.6 }}>
                O HELION explica apenas termos de tecnologia. Tente uma sigla, ferramenta ou conceito da área.
              </p>
              <button type="button" onClick={reset} style={ghostBtn}>Tentar outro termo</button>
            </div>
          )}

          {erro && !loading && (
            <div role="alert" style={{ ...glassCard, marginTop: 20, borderColor: `${C.danger}66` }}>
              <h2 style={{ fontFamily: FONT_DISPLAY, color: C.text, fontSize: 17, margin: "0 0 8px", fontWeight: 600 }}>Não deu certo desta vez 😕</h2>
              <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: C.textMd, margin: 0 }}>{erro}</p>
              <button type="button" onClick={submit} className="helion-ghost" style={{ ...ghostBtn, color: C.amber, borderColor: C.borderAmberHi }}>Tentar novamente</button>
            </div>
          )}

          {resposta && !loading && (
            <article style={{ ...glassCard, marginTop: 20 }} aria-label="Explicação">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Badge label={modo === "casual" ? "Casual" : "Técnica"} />
                <Badge label={tamanho === "curta" ? "Curta" : "Longa"} />
                {analise === "codigo" && <Badge label="Código" />}
                <button type="button" onClick={copy} className="helion-ghost" aria-label="Copiar explicação"
                  style={{ marginLeft: "auto", padding: "8px 14px", minHeight: 40, borderRadius: 8, border: `1px solid ${C.borderAmber}`, background: "transparent", color: C.amber, fontFamily: FONT_MONO, fontSize: 12, cursor: "pointer" }}>
                  {copied ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <div style={{ height: 1, background: C.border, margin: "20px 0" }} />
              <RichText text={resposta} />
              <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.textLt, margin: "4px 0 0" }}>
                ⚠️ Explicação gerada por IA; pode conter erros. Na dúvida, confira na documentação oficial.
              </p>

              <HelpScale score={score} onChange={onScore} termo={termo} modo={modo} tamanho={tamanho} analise={analise} requestId={requestId} />

              <button type="button" onClick={() => openDeep(deepFromResult)} className="helion-ghost"
                style={{ marginTop: 20, width: "100%", padding: "13px 18px", minHeight: 48, borderRadius: 12, border: `1px solid ${score === 50 || score === 75 ? C.borderAmberHi : C.borderAmber}`, background: "transparent", color: C.amber, fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 15, cursor: "pointer" }}>
                Abrir Compêndio Avançado →
              </button>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                <AuditButton onClick={() => { track("click", { nome: "erramos" }); setAuditOpen(true); }} emphasized={score !== null && score <= 25} />
              </div>

              <div style={{ marginTop: 14, textAlign: "center" }}>
                <button type="button" onClick={reset} style={{ background: "transparent", border: "none", fontFamily: FONT_MONO, color: C.textLt, cursor: "pointer", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", minHeight: 44, padding: "0 16px" }}>
                  Nova consulta →
                </button>
              </div>
            </article>
          )}
        </div>
      </main>

      {deepTermo && (
        <DeepDiveView termo={deepTermo} analise={resposta && deepTermo === deepFromResult ? analise : "padrao"}
          contextoCodigo={analise === "codigo" && resposta && deepTermo === deepFromResult ? resposta.slice(0, 1200) : null}
          onClose={closeDeep} onAudit={() => setAuditOpen(true)} />
      )}

      {auditOpen && (
        <AuditModal termo={deepTermo || termo || "imagem enviada"} resposta={resposta ?? ""} score={score} requestId={requestId} onClose={() => setAuditOpen(false)} />
      )}

      {!deepTermo && <InstitutionalFooter />}
    </div>
  );
}

const ghostBtn: CSSProperties = { marginTop: 16, padding: "10px 16px", minHeight: 44, borderRadius: 8, border: `1px solid rgba(255,255,255,0.18)`, background: "transparent", color: C.textMd, fontFamily: FONT_BODY, fontSize: 14, cursor: "pointer" };

/* ---------- SUB-COMPONENTS ---------- */
function OptionGroup({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; desc: string }[];
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div style={{ marginTop: 22 }}>
      <div id={id} style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em", color: C.textLt, textTransform: "uppercase", marginBottom: 10, fontWeight: 500 }}>{label}</div>
      <div role="radiogroup" aria-labelledby={id} className="opt-grid">
        {options.map((o, i) => (
          <GlassOption key={o.value} ref={(el) => { refs.current[i] = el; }} active={value === o.value} onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)} label={o.label} desc={o.desc} />
        ))}
      </div>
    </div>
  );
}

const GlassOption = forwardRef<HTMLButtonElement, { active: boolean; onClick: () => void; onKeyDown: (e: React.KeyboardEvent) => void; label: string; desc: string }>(
  function GlassOption({ active, onClick, onKeyDown, label, desc }, ref) {
    return (
      <button ref={ref} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} onClick={onClick} onKeyDown={onKeyDown}
        style={{
          textAlign: "left", padding: "14px 16px", borderRadius: 12, minHeight: 64, display: "flex", gap: 12, alignItems: "flex-start",
          border: `${active ? 2 : 1}px solid ${active ? C.amber : "rgba(255,255,255,0.14)"}`,
          background: active ? "rgba(245,158,11,0.12)" : C.surface, cursor: "pointer", fontFamily: FONT_BODY, transition: "all 0.15s ease",
        }}>
        <span aria-hidden style={{ flex: "0 0 auto", width: 20, height: 20, marginTop: 1, borderRadius: "50%", border: `2px solid ${active ? C.amber : "rgba(255,255,255,0.4)"}`, display: "grid", placeItems: "center" }}>
          {active && <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.amber }} />}
        </span>
        <span>
          <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: active ? C.amberHi : C.text }}>{label}</span>
          <span style={{ display: "block", fontFamily: FONT_BODY, fontSize: 13, color: C.textXLt, marginTop: 3, lineHeight: 1.45 }}>{desc}</span>
        </span>
      </button>
    );
  },
);

function Badge({ label }: { label: string }) {
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 4, color: C.textMd, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
      {label}
    </span>
  );
}

function RichText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((p) => p.split(/(\*\*[^*]+\*\*)/g));
  }, [text]);
  return (
    <div style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 15, lineHeight: 1.7 }}>
      {parts.map((para, i) => (
        <p key={i} style={{ margin: "0 0 14px" }}>
          {para.map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} style={{ color: C.text, fontWeight: 600 }}>{seg.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{seg}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function HelpScale({ score, onChange, termo, modo, tamanho, analise, requestId }: {
  score: number | null; onChange: (v: number) => void; termo: string; modo: Mode; tamanho: Length; analise: Analise; requestId?: string;
}) {
  const callNota = useServerFn(enviarNota);
  const current = score === null ? null : SCALE.find((s) => s.value === score) ?? SCALE[0];
  const [comentario, setComentario] = useState("");
  const [st, setSt] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const sendComment = async () => {
    if (!comentario.trim() || score === null) return;
    setSt("sending");
    try {
      await callNota({ data: { score, comentario: comentario.trim(), termo: termo.slice(0, 200), modo, tamanho, analise, requestId, sessionId } });
      setSt("ok"); setComentario("");
    } catch { setSt("err"); }
  };
  return (
    <div style={{ marginTop: 28, paddingTop: 22, borderTop: `1px solid ${C.border}` }}>
      <label htmlFor="help-scale" style={{ display: "block", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em", color: C.textLt, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>
        Quanto nós te ajudamos?
      </label>
      <div aria-live="polite" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 12, minHeight: 56 }}>
        {current ? (
          <>
            <span style={{ fontSize: 28 }} aria-hidden>{current.icon}</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: C.text, fontStyle: "italic", textAlign: "center", maxWidth: 380 }}>“{current.phrase}”</span>
          </>
        ) : (
          <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.textLt }}>Arraste ou use as setas para avaliar (opcional)</span>
        )}
      </div>
      <input id="help-scale" type="range" min={0} max={100} step={25} value={score ?? 50}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => { if (score === null && (e.key === "Enter" || e.key === " ")) onChange(50); }}
        className={`helion-slider${score === null ? " neutral" : ""}`}
        aria-valuetext={current ? `${current.value}%: ${current.phrase}` : "Ainda não avaliado"} />
      <div aria-hidden style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: FONT_MONO, fontSize: 12, color: C.textLt }}>
        {SCALE.map((s) => <span key={s.value} style={{ color: score === s.value ? C.amber : C.textLt }}>{s.value}%</span>)}
      </div>
      {score !== null && (
        <div style={{ marginTop: 14 }}>
          <label htmlFor="nota-coment" className="sr-only">Comentário sobre a explicação (opcional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="nota-coment" type="text" value={comentario} maxLength={500} onChange={(e) => { setComentario(e.target.value); setSt("idle"); }}
              placeholder={score <= 25 ? "O que faltou? (opcional)" : "Quer deixar um comentário? (opcional)"}
              style={{ flex: 1, minHeight: 44, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "0 12px", color: C.text, fontFamily: FONT_BODY, fontSize: 14 }} />
            <button type="button" onClick={sendComment} disabled={!comentario.trim() || st === "sending"} className="helion-ghost"
              style={{ minHeight: 44, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.borderAmber}`, background: "transparent", color: C.amber, fontFamily: FONT_MONO, fontSize: 12, cursor: "pointer", opacity: comentario.trim() ? 1 : 0.6 }}>
              {st === "sending" ? "Enviando…" : "Enviar"}
            </button>
          </div>
          <p aria-live="polite" style={{ fontSize: 13, margin: "6px 0 0", color: st === "err" ? "#FCA5A5" : C.amberHi, minHeight: 16 }}>
            {st === "ok" ? "Obrigado! Comentário recebido." : st === "err" ? "Não foi possível enviar. Tente de novo." : ""}
          </p>
          {(score === 50 || score === 75) && <p style={{ fontSize: 13, color: C.amberHi, margin: "4px 0 0" }}>↓ Dica: o Compêndio Avançado aprofunda o tema.</p>}
          {score <= 25 && <p style={{ fontSize: 13, color: C.amberHi, margin: "4px 0 0" }}>↓ Nos ajude a corrigir: clique em “Erramos em algo?”.</p>}
        </div>
      )}
    </div>
  );
}

function AuditButton({ onClick, emphasized }: { onClick: () => void; emphasized?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="helion-ghost"
      style={{
        padding: "12px 28px", minHeight: 44, borderRadius: 999, border: `1px solid ${emphasized ? C.borderAmberHi : C.borderAmber}`,
        background: emphasized ? C.amberSoft : "transparent", color: C.amber, fontFamily: FONT_MONO, fontSize: 12, fontWeight: 500,
        letterSpacing: "0.14em", cursor: "pointer", textTransform: "uppercase",
      }}>
      Erramos em algo?
    </button>
  );
}

/* ---------- AUDIT MODAL (real: DynamoDB + SNS e-mail) ---------- */
function AuditModal({ termo, resposta, score, requestId, onClose }: { termo: string; resposta: string; score: number | null; requestId?: string; onClose: () => void }) {
  const callReport = useServerFn(reportarErro);
  const [text, setText] = useState("");
  const [contato, setContato] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const valid = text.trim().length >= 5;

  const submit = async () => {
    if (!valid || state === "sending") return;
    const last = Number(sessionStorage.getItem("helion-fb-at") || 0);
    if (Date.now() - last < 30_000) { setState("error"); setErrMsg("Aguarde alguns segundos antes de enviar outra contestação."); return; }
    setState("sending");
    try {
      await callReport({ data: { texto: text.trim(), termo: termo.slice(0, 200), resposta: resposta.slice(0, 4000), score, contato: contato.trim() || undefined, website, requestId, sessionId } });
      sessionStorage.setItem("helion-fb-at", String(Date.now()));
      setState("sent");
      setTimeout(onClose, 2500);
    } catch (e) {
      setState("error"); setErrMsg(friendly(e, "Não conseguimos enviar agora. Tente novamente em instantes."));
    }
  };

  const field: CSSProperties = { width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "12px 14px", fontFamily: FONT_BODY, fontSize: 15, color: C.text, boxSizing: "border-box" };

  return (
    <Overlay onClose={onClose} labelledBy="audit-title">
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.14em", color: C.amber, textTransform: "uppercase", marginBottom: 10 }}>Auditoria de precisão</div>
      <h2 id="audit-title" style={{ fontFamily: FONT_BODY, color: C.text, fontSize: 18, lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
        Erramos em algo? Conte pra gente.
      </h2>
      <p style={{ fontFamily: FONT_BODY, color: C.textLt, fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
        Sua mensagem vai direto para o e-mail do responsável. Se puder, inclua links de documentação oficial.
      </p>
      {state !== "sent" ? (
        <>
          <label htmlFor="audit-text" style={{ display: "block", marginTop: 16, fontSize: 14, color: C.textMd }}>O que está errado? *</label>
          <textarea id="audit-text" autoFocus value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} rows={5}
            placeholder="Descreva o erro…" style={{ ...field, marginTop: 6, resize: "vertical" }} />
          <label htmlFor="audit-contato" style={{ display: "block", marginTop: 12, fontSize: 14, color: C.textMd }}>Seu e-mail para resposta (opcional)</label>
          <input id="audit-contato" type="text" inputMode="email" autoComplete="email" value={contato} maxLength={120} onChange={(e) => setContato(e.target.value)} style={{ ...field, marginTop: 6, minHeight: 44 }} />
          <div aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            <label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>
          <p role={state === "error" ? "alert" : undefined} style={{ minHeight: 18, fontSize: 13, color: "#FCA5A5", margin: "10px 0 0" }}>{state === "error" ? errMsg : ""}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 18px", minHeight: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: C.textMd, fontFamily: FONT_BODY, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
            <button type="button" onClick={submit} aria-disabled={!valid || state === "sending"} className="helion-primary"
              style={{ padding: "10px 22px", minHeight: 44, borderRadius: 10, border: `1px solid ${C.borderAmberHi}`, background: C.amberSoft, color: C.amber, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500, letterSpacing: "0.12em", cursor: valid ? "pointer" : "not-allowed", textTransform: "uppercase", opacity: valid && state !== "sending" ? 1 : 0.55 }}>
              {state === "sending" ? "Enviando…" : state === "error" ? "Tentar de novo" : "Enviar"}
            </button>
          </div>
        </>
      ) : (
        <div role="status" style={{ marginTop: 22, padding: 18, borderRadius: 12, background: C.amberSoft, border: `1px solid ${C.borderAmber}`, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }} aria-hidden>✨</div>
          <div style={{ fontFamily: FONT_DISPLAY, color: C.amberHi, fontSize: 16, fontWeight: 600 }}>Recebido, obrigado!</div>
          <div style={{ fontFamily: FONT_BODY, color: C.textLt, fontSize: 13, marginTop: 6 }}>Sua contestação foi enviada e será analisada.</div>
        </div>
      )}
    </Overlay>
  );
}

/* ---------- OVERLAY (accessible dialog: role, focus trap, Esc, focus return) ---------- */
function Overlay({ children, onClose, labelledBy }: { children: React.ReactNode; onClose: () => void; labelledBy: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(box.current?.querySelectorAll<HTMLElement>('button, [href], input:not([tabindex="-1"]), textarea, [tabindex="0"]') ?? []);
    if (!box.current?.contains(document.activeElement)) focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables(); if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "overlayIn 0.2s ease both" }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: C.bgSoft, border: `1px solid ${C.borderAmber}`, borderRadius: 18, padding: "clamp(20px, 5vw, 28px)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)", animation: "slideIn 0.25s ease both", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- INSTITUTIONAL FOOTER ---------- */
function InstitutionalFooter() {
  return (
    <footer style={{ position: "relative", marginTop: 48, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 24px", maxWidth: 1200, marginInline: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT_MONO, fontSize: 12, color: C.textLt, flexWrap: "wrap", gap: 8 }}>
        <span>HELION © 2026 · Explicações geradas por IA (Amazon Bedrock); podem conter erros.</span>
        <span style={{ fontStyle: "italic" }}>Inspirado por Helena Laura de Farias, a leoa que iluminou todo o caminho.</span>
      </div>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.textLt, margin: "8px 0 0" }}>
        Privacidade: coletamos apenas métricas anônimas de uso (sem IP puro, sem guardar imagens) para melhorar o serviço.
      </p>
    </footer>
  );
}

/* ---------- DEEP DIVE ---------- */
function DeepDiveView({
  termo, analise, contextoCodigo, onClose, onAudit,
}: {
  termo: string;
  analise: Analise;
  contextoCodigo: string | null;
  onClose: () => void;
  onAudit: () => void;
}) {
  const callDeep = useServerFn(deepDive);
  const [data, setData] = useState<null | Awaited<ReturnType<typeof callDeep>>>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const msg = useRotating(loading, DEEP_MSGS, 2200);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const key = `helion-deep:${analise}:${termo}`;
    const cached = sessionStorage.getItem(key);
    if (cached) { setData(JSON.parse(cached)); setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr(null); setData(null);
    withTimeout(callDeep({ data: { termo: termo.slice(0, 200), analise, contextoCodigo, sessionId } }), 35000)
      .then((d) => { if (!alive) return; setData(d); try { sessionStorage.setItem(key, JSON.stringify(d)); } catch { /* full */ } })
      .catch((e) => { if (alive) setErr(friendly(e, "Não conseguimos montar o compêndio agora.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, analise, attempt]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = encodeURIComponent(termo);

  return (
    <section aria-labelledby="deep-title" style={{ position: "fixed", inset: 0, zIndex: 50, background: C.bg, overflowY: "auto", animation: "slideIn 0.3s ease both" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 96px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.16em", color: C.amber, textTransform: "uppercase", fontWeight: 500 }}>
              Compêndio Avançado
            </div>
            <h1 id="deep-title" ref={titleRef} tabIndex={-1} style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.text, letterSpacing: "-0.025em", margin: "4px 0 0", outline: "none", wordBreak: "break-word" }}>
              {termo}
            </h1>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.18)", padding: "10px 16px", minHeight: 44, borderRadius: 10, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, color: C.textMd }}>
            Voltar
          </button>
        </div>
        <div style={{ height: 1, background: C.border, margin: "28px 0" }} />

        <div aria-live="polite" aria-busy={loading}>
        {loading && (
          <div role="status">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <Spinner />
              <span style={{ fontFamily: FONT_MONO, color: C.textMd, fontSize: 13 }}>{msg}</span>
            </div>
            {[90, 100, 72, 95, 60].map((w, i) => <div key={i} className="skel" style={{ width: `${w}%` }} />)}
          </div>
        )}

        {err && (
          <div role="alert" style={{ background: C.surface, border: `1px solid ${C.danger}66`, padding: 18, borderRadius: 12 }}>
            <p style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 15, margin: 0 }}>{err}</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} style={{ ...ghostBtn, color: C.amber, borderColor: C.borderAmberHi }}>Tentar novamente</button>
          </div>
        )}
        </div>

        {data && (
          <>
            <DeepSection label="Exploração completa"><RichText text={data.profundidade} /></DeepSection>
            {data.exemplo && (
              <DeepSection label="Exemplo real"><RichText text={data.exemplo} /></DeepSection>
            )}
            {data.analogia && (
              <DeepSection label="Analogia">
                <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textMd, fontSize: 16, lineHeight: 1.65, margin: 0 }}>
                  {data.analogia}
                </p>
              </DeepSection>
            )}
            {data.relacionados.length > 0 && (
              <DeepSection label="Conceitos relacionados">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {data.relacionados.map((r: string) => (
                    <a key={r} href={`https://www.google.com/search?q=${encodeURIComponent(r)}`} target="_blank" rel="noopener noreferrer"
                       style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, color: C.amber, fontFamily: FONT_BODY, fontSize: 13, textDecoration: "none" }}>
                      {r}
                    </a>
                  ))}
                </div>
              </DeepSection>
            )}
            <DeepSection label="Para aprender mais">
              <div style={{ display: "grid", gap: 10 }}>
                <LinkCard title="YouTube" subtitle={`Vídeos sobre "${termo}"`} href={`https://www.youtube.com/results?search_query=${q}`} />
                <LinkCard title="Wikipédia" subtitle="Artigo enciclopédico" href={`https://pt.wikipedia.org/wiki/Special:Search?search=${q}`} />
                <LinkCard title="Busca avançada" subtitle="Google + tutorial" href={`https://www.google.com/search?q=${q}+tutorial`} />
                {data.docLink && (
                  <LinkCard title="Documentação oficial" subtitle="Fonte primária" href={data.docLink} />
                )}
              </div>
            </DeepSection>

            {analise === "codigo" && data.videos.length > 0 && (
              <DeepSection label="Vídeos recomendados">
                <div style={{ display: "grid", gap: 10 }}>
                  {data.videos.map((v) => (
                    <LinkCard key={v.url} title={v.titulo} subtitle="YouTube · vídeo" href={v.url} />
                  ))}
                </div>
              </DeepSection>
            )}
            {analise === "codigo" && data.artigos.length > 0 && (
              <DeepSection label="Artigos e textos">
                <div style={{ display: "grid", gap: 10 }}>
                  {data.artigos.map((v) => (
                    <LinkCard key={v.url} title={v.titulo} subtitle="Artigo / texto" href={v.url} />
                  ))}
                </div>
              </DeepSection>
            )}
            {analise === "codigo" && data.exemplosLinks.length > 0 && (
              <DeepSection label="Exemplos práticos">
                <div style={{ display: "grid", gap: 10 }}>
                  {data.exemplosLinks.map((v) => (
                    <LinkCard key={v.url} title={v.titulo} subtitle="Exemplo / repositório" href={v.url} />
                  ))}
                </div>
              </DeepSection>
            )}

            {/* AUDIT BUTTON inside deep dive */}
            <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
              <AuditButton onClick={onAudit} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function DeepSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.12em", color: C.textLt, textTransform: "uppercase", margin: "0 0 12px", fontWeight: 500 }}>
        {label}
      </h2>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
        {children}
      </div>
    </section>
  );
}

function LinkCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, textDecoration: "none", color: C.text, transition: "all 0.15s" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.text }}>{title}</div>
        <div style={{ fontFamily: FONT_BODY, color: C.textLt, fontSize: 12, marginTop: 2 }}>{subtitle}</div>
      </div>
      <span aria-hidden style={{ fontFamily: FONT_MONO, color: C.amber }}>↗</span><span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}