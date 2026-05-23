import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { humanize, deepDive } from "@/lib/helion.functions";
import lionImg from "@/assets/helion-lion.png";

export const Route = createFileRoute("/")({
  component: Helion,
});

/* ---------- DESIGN TOKENS — Charcoal & Ember ---------- */
const C = {
  bg: "#0b0b0d",
  bg2: "#111114",
  surface: "#16161a",
  surfaceHi: "#1d1d22",
  surfaceLo: "#0f0f12",
  border: "#2a2a31",
  borderHi: "#3a3a44",
  text: "#f5f3ee",
  textMd: "#b8b5ac",
  textLt: "#73707a",
  ember: "#ff7a3a",
  emberHi: "#ffa55c",
  emberDk: "#c4421a",
  gold: "#e0b25a",
  goldDk: "#a07a28",
  glow: "rgba(255,122,58,0.35)",
  shadow: "rgba(0,0,0,0.55)",
  danger: "#ff5a5a",
};

const FONT_DISPLAY = `'Space Grotesk', system-ui, sans-serif`;
const FONT_BODY = `'DM Sans', system-ui, sans-serif`;
const FONT_MONO = `'JetBrains Mono', ui-monospace, monospace`;

/* ---------- ICONS ---------- */
function ChatIcon({ active }: { active: boolean }) {
  const color = active ? C.ember : C.textLt;
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M6 9 C6 7 7.5 6 9.5 6 H22.5 C24.5 6 26 7.5 26 9.5 V18 C26 20 24.5 21.5 22.5 21.5 H14 L9 26 V21.5 H9.5 C7.5 21.5 6 20 6 18 Z" />
      <circle cx="12" cy="14" r="1.3" fill={color} stroke="none" />
      <circle cx="16" cy="14" r="1.3" fill={color} stroke="none" />
      <circle cx="20" cy="14" r="1.3" fill={color} stroke="none" />
    </svg>
  );
}

function CircuitIcon({ active }: { active: boolean }) {
  const color = active ? C.gold : C.textLt;
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke={color} strokeWidth="1.8">
      <circle cx="16" cy="16" r="2.8" fill={color} stroke="none" />
      <line x1="16" y1="6" x2="16" y2="11" strokeLinecap="round" />
      <line x1="16" y1="21" x2="16" y2="26" strokeLinecap="round" />
      <line x1="6" y1="16" x2="11" y2="16" strokeLinecap="round" />
      <line x1="21" y1="16" x2="26" y2="16" strokeLinecap="round" />
      <circle cx="16" cy="5" r="1.6" />
      <circle cx="16" cy="27" r="1.6" />
      <circle cx="5" cy="16" r="1.6" />
      <circle cx="27" cy="16" r="1.6" />
    </svg>
  );
}

function LionHero({ size = 140 }: { size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      <div style={{
        position: "absolute", inset: -20, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.glow} 0%, transparent 65%)`,
        animation: "pulseGlow 4s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <img
        src={lionImg}
        alt="HELION mascote — leão mecânico"
        width={size}
        height={size}
        style={{ position: "relative", width: size, height: size, objectFit: "contain", filter: `drop-shadow(0 4px 22px ${C.glow})` }}
      />
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: C.borderHi }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${C.border})` }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, letterSpacing: "0.3em" }}>◆◆◆</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${C.border})` }} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ position: "relative", width: 48, height: 48 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        border: `2px solid ${C.border}`,
        borderTopColor: C.ember,
        borderRightColor: C.gold,
        animation: "spin 1s linear infinite",
      }} />
      <div style={{
        position: "absolute", inset: 10, borderRadius: "50%",
        border: `2px solid ${C.border}`,
        borderBottomColor: C.ember,
        animation: "spin 1.4s linear infinite reverse",
      }} />
    </div>
  );
}

/* ---------- TYPES ---------- */
type Mode = "casual" | "tecnica";
type Length = "curta" | "longa";
type Feedback = "good" | "meh" | "bad" | null;

/* ---------- MAIN ---------- */
function Helion() {
  const [termo, setTermo] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [modo, setModo] = useState<Mode | null>(null);
  const [tamanho, setTamanho] = useState<Length | null>(null);
  const [loading, setLoading] = useState(false);
  const [resposta, setResposta] = useState<string | null>(null);
  const [foraEscopo, setForaEscopo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const callHumanize = useServerFn(humanize);

  const canSubmit = (termo.trim().length > 0 || imageDataUrl) && modo && tamanho && !loading;

  const handleFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      setImageDataUrl(r.result as string);
      setImageName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  const reset = () => {
    setTermo("");
    setImageDataUrl(null);
    setImageName(null);
    setModo(null);
    setTamanho(null);
    setResposta(null);
    setForaEscopo(false);
    setErro(null);
    setFeedback(null);
    setDeepOpen(false);
  };

  const submit = async () => {
    if (!canSubmit || !modo || !tamanho) return;
    setLoading(true);
    setResposta(null);
    setForaEscopo(false);
    setErro(null);
    setFeedback(null);
    try {
      const out = await callHumanize({ data: { termo, modo, tamanho, imageDataUrl } });
      if (out.foraDeEscopo) setForaEscopo(true);
      else setResposta(out.texto);
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao contatar o oráculo.");
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  /* ---- styles ---- */
  const pageBg: CSSProperties = {
    minHeight: "100vh",
    backgroundColor: C.bg,
    backgroundImage: `
      radial-gradient(ellipse at 50% -10%, rgba(255,122,58,0.18), transparent 50%),
      radial-gradient(ellipse at 100% 100%, rgba(224,178,90,0.07), transparent 50%),
      linear-gradient(${C.border}22 1px, transparent 1px),
      linear-gradient(90deg, ${C.border}22 1px, transparent 1px)
    `,
    backgroundSize: "auto, auto, 44px 44px, 44px 44px",
    color: C.text,
    fontFamily: FONT_BODY,
    position: "relative",
    overflowX: "hidden",
  };

  const container: CSSProperties = {
    maxWidth: 640,
    margin: "0 auto",
    padding: "44px 20px 80px",
    position: "relative",
    zIndex: 1,
  };

  const cardStyle: CSSProperties = {
    background: `linear-gradient(180deg, ${C.surface}, ${C.surfaceLo})`,
    borderRadius: 18,
    padding: 26,
    boxShadow: `0 10px 40px ${C.shadow}, 0 0 0 1px ${C.border} inset, 0 1px 0 rgba(255,255,255,0.04) inset`,
    position: "relative",
    overflow: "hidden",
    animation: "fadeUp 0.55s ease both",
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: 10.5,
    letterSpacing: "0.22em",
    color: C.textLt,
    textTransform: "uppercase",
    marginBottom: 10,
    display: "block",
  };

  const textareaStyle: CSSProperties = {
    width: "100%",
    minHeight: 64,
    background: C.surfaceLo,
    border: `1px solid ${termo ? C.ember : C.border}`,
    borderRadius: 12,
    padding: "14px 16px",
    fontFamily: FONT_MONO,
    fontSize: 15,
    color: C.text,
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
    boxShadow: termo ? `0 0 0 3px ${C.ember}22` : "none",
  };

  return (
    <div style={pageBg}>
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg) } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideIn    { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseGlow  { 0%,100% { opacity:0.7; transform:scale(1) } 50% { opacity:1; transform:scale(1.08) } }
        @keyframes shimmer    { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        * { box-sizing: border-box; }
        body { background: ${C.bg}; }
        ::placeholder { font-family: ${FONT_MONO}; color: ${C.textLt}; opacity: 0.7; }
        textarea:focus { border-color: ${C.ember} !important; box-shadow: 0 0 0 3px ${C.ember}33 !important; }
        button:not(:disabled):hover { filter: brightness(1.12); }
        a:hover { color: ${C.emberHi}; }
      `}</style>

      <div style={container}>
        {/* HEADER */}
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.32em", color: C.gold, textTransform: "uppercase", marginBottom: 20, padding: "6px 14px", border: `1px solid ${C.border}`, borderRadius: 999, background: C.surfaceLo }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.ember, boxShadow: `0 0 10px ${C.ember}` }} />
            <span>tech glossary engine</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <LionHero size={148} />
            <div style={{ textAlign: "center" }}>
              <h1 style={{
                fontFamily: FONT_DISPLAY,
                fontSize: "clamp(3rem, 12vw, 4.5rem)",
                margin: 0,
                lineHeight: 0.95,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                background: `linear-gradient(180deg, ${C.text} 0%, ${C.text} 55%, ${C.emberHi} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                HELION
              </h1>
              <p style={{ fontFamily: FONT_BODY, color: C.textMd, marginTop: 10, fontSize: 14, letterSpacing: "0.02em" }}>
                domine qualquer jargão. <span style={{ color: C.ember }}>queime a complexidade.</span>
              </p>
            </div>
          </div>
        </header>

        {/* MAIN CARD */}
        <div style={cardStyle}>
          {/* top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${C.ember}, ${C.gold}, ${C.ember}, transparent)`,
            backgroundSize: "200% 100%",
            animation: "shimmer 6s linear infinite",
          }} />

          {/* TEXTAREA */}
          <div style={{ position: "relative" }}>
            <span style={labelStyle}>[01] entrada · termo, sigla ou expressão</span>
            <textarea
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={onKey}
              placeholder="API REST · machine learning · latência · Docker..."
              rows={2}
              style={textareaStyle}
            />
            {termo && (
              <span style={{ position: "absolute", right: 10, bottom: 10, fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, background: C.bg, padding: "3px 7px", borderRadius: 4, border: `1px solid ${C.border}` }}>
                ↵ enter
              </span>
            )}
          </div>

          {/* UPLOAD ZONE */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              marginTop: 14,
              padding: imageDataUrl ? 10 : 16,
              border: `1px dashed ${imageDataUrl ? C.ember : dragOver ? C.gold : C.border}`,
              borderRadius: 12,
              background: imageDataUrl ? `${C.ember}15` : C.surfaceLo,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: imageDataUrl ? "flex-start" : "center",
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              color: imageDataUrl ? C.emberHi : C.textLt,
              transition: "all 0.2s",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {imageDataUrl ? (
              <>
                <img src={imageDataUrl} alt={imageName ?? ""} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.ember}` }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setImageDataUrl(null); setImageName(null); }}
                  style={{ background: "transparent", border: "none", color: C.ember, cursor: "pointer", fontSize: 16, fontFamily: FONT_MONO }}
                  aria-label="remover imagem"
                >✕</button>
              </>
            ) : (
              <span>[ img ] arraste uma captura de tela ou clique</span>
            )}
          </div>

          <Divider />

          {/* MODE BUTTONS */}
          <span style={labelStyle}>[02] modo de explicação</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ModeCard
              active={modo === "casual"}
              onClick={() => setModo("casual")}
              accent={C.ember}
              icon={<ChatIcon active={modo === "casual"} />}
              label="Casual"
              desc="sem formalidades"
            />
            <ModeCard
              active={modo === "tecnica"}
              onClick={() => setModo("tecnica")}
              accent={C.gold}
              icon={<CircuitIcon active={modo === "tecnica"} />}
              label="Técnica"
              desc="pra quem é da área"
            />
          </div>

          {/* LENGTH BUTTONS */}
          <div style={{ marginTop: 16 }}>
            <span style={labelStyle}>[03] tamanho da resposta</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <LenButton active={tamanho === "curta"} onClick={() => setTamanho("curta")} accent={C.ember} symbol="◢" label="Curta" desc="rápido e direto" />
              <LenButton active={tamanho === "longa"} onClick={() => setTamanho("longa")} accent={C.gold} symbol="◢◣" label="Longa" desc="exemplos + contexto" />
            </div>
          </div>

          {/* SUBMIT */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              marginTop: 24,
              width: "100%",
              padding: "16px 24px",
              borderRadius: 12,
              border: `1px solid ${canSubmit ? C.emberDk : C.border}`,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: canSubmit ? "#fff" : C.textLt,
              background: canSubmit
                ? `linear-gradient(135deg, ${C.ember}, ${C.emberDk})`
                : C.surfaceHi,
              boxShadow: canSubmit ? `0 10px 30px ${C.glow}, 0 0 0 1px ${C.ember}55 inset` : "none",
              transition: "all 0.2s",
            }}
          >
            {loading ? "⟳  processando..." : "▲  HUMANIZAR"}
          </button>
          {!canSubmit && (termo || imageDataUrl) && !loading && (
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLt, textAlign: "center", marginTop: 12, letterSpacing: "0.1em" }}>
              selecione modo e tamanho para ativar
            </p>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div style={{ ...cardStyle, marginTop: 20, display: "flex", alignItems: "center", gap: 18, justifyContent: "center", padding: 28 }}>
            <Spinner />
            <span style={{ fontFamily: FONT_MONO, color: C.textMd, fontSize: 13, letterSpacing: "0.1em" }}>
              compilando<span style={{ color: C.ember }}>_</span>
            </span>
          </div>
        )}

        {/* FORA DE ESCOPO */}
        {foraEscopo && !loading && (
          <div style={{ ...cardStyle, marginTop: 20, borderColor: C.gold }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.gold, letterSpacing: "0.2em", marginBottom: 6 }}>ERR_404 · OUT_OF_SCOPE</div>
            <h3 style={{ fontFamily: FONT_DISPLAY, color: C.text, fontSize: 22, margin: "4px 0 12px", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Fora do território tech.
            </h3>
            <p style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 15, lineHeight: 1.6 }}>
              Este motor analisa somente tecnologia. Receitas, signos e fofoca não constam no banco de dados.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 16, padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.gold}`, background: "transparent", color: C.gold, fontFamily: FONT_MONO, fontSize: 12, cursor: "pointer", letterSpacing: "0.1em" }}
            >← tentar novamente</button>
          </div>
        )}

        {/* ERROR */}
        {erro && !loading && (
          <div style={{ ...cardStyle, marginTop: 20, borderColor: C.danger }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.danger }}>
              ERR :: {erro}
            </span>
          </div>
        )}

        {/* RESULTADO */}
        {resposta && !loading && (
          <div style={{ ...cardStyle, marginTop: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge color={modo === "casual" ? C.ember : C.gold} label={modo === "casual" ? "casual" : "técnica"} />
              <Badge color={C.textMd} label={tamanho === "curta" ? "curta" : "longa"} />
            </div>
            <div style={{ height: 1, background: C.border, margin: "16px 0" }} />
            <RichText text={resposta} />
            <Divider />
            <span style={labelStyle}>avaliação</span>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <FbBtn active={feedback === "good"} onClick={() => setFeedback("good")} emoji="🔥" label="acendeu!" accent={C.ember} />
              <FbBtn active={feedback === "meh"} onClick={() => setFeedback("meh")} emoji="◐" label="mais ou menos" accent={C.gold} />
              <FbBtn active={feedback === "bad"} onClick={() => setFeedback("bad")} emoji="✕" label="não ajudou" accent={C.danger} />
            </div>
            {feedback === "good" && (
              <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.ember, textAlign: "center", marginTop: 12, letterSpacing: "0.08em" }}>
                &gt; agradecido. o leão ruge.
              </p>
            )}
            {(feedback === "bad" || feedback === "meh") && (
              <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.textLt, textAlign: "center", marginTop: 12, letterSpacing: "0.08em" }}>
                &gt; tente outro modo de explicação.
              </p>
            )}

            <button
              onClick={() => setDeepOpen(true)}
              style={{
                marginTop: 20, width: "100%", padding: "14px 18px", borderRadius: 12,
                border: `1px solid ${C.gold}`,
                background: `linear-gradient(135deg, ${C.gold}22, ${C.surfaceLo})`,
                color: C.gold, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >⊕ Compêndio Avançado →</button>
            <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textLt, textAlign: "center", marginTop: 8, letterSpacing: "0.05em" }}>
              analogias, exemplos e conceitos relacionados
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 14, borderTop: `1px dashed ${C.border}`, fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, letterSpacing: "0.14em" }}>
              <span>helion · v1.0</span>
              <button onClick={reset} style={{ background: "transparent", border: "none", fontFamily: FONT_MONO, color: C.ember, cursor: "pointer", fontSize: 11, letterSpacing: "0.1em" }}>
                ← nova busca
              </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer style={{ marginTop: 40, textAlign: "center", fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, letterSpacing: "0.2em" }}>
          <span>// powered by lovable ai · {new Date().getFullYear()}</span>
        </footer>
      </div>

      {deepOpen && resposta && (
        <DeepDiveView termo={termo || "imagem enviada"} onClose={() => setDeepOpen(false)} />
      )}
    </div>
  );
}

/* ---------- SUB-COMPONENTS ---------- */
function ModeCard({ active, onClick, accent, icon, label, desc }: { active: boolean; onClick: () => void; accent: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${active ? accent : C.border}`,
        background: active ? `linear-gradient(135deg, ${accent}22, ${C.surfaceLo})` : C.surfaceLo,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        transition: "all 0.2s",
        boxShadow: active ? `0 0 0 1px ${accent}55, 0 6px 20px ${accent}22` : "none",
      }}
    >
      {active && (
        <span style={{ position: "absolute", top: 8, right: 10, width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: active ? accent + "22" : C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${active ? accent + "55" : C.border}` }}>
          {icon}
        </div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: active ? accent : C.text, letterSpacing: "-0.01em" }}>{label}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.textLt, marginTop: 2, letterSpacing: "0.04em" }}>{desc}</div>
        </div>
      </div>
    </button>
  );
}

function LenButton({ active, onClick, accent, symbol, label, desc }: { active: boolean; onClick: () => void; accent: string; symbol: string; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        border: `1px solid ${active ? accent : C.border}`,
        background: active ? `linear-gradient(135deg, ${accent}22, ${C.surfaceLo})` : C.surfaceLo,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        textAlign: "center",
        boxShadow: active ? `0 0 0 1px ${accent}55` : "none",
        transition: "all 0.2s",
      }}
    >
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: active ? accent : C.text }}>
        <span style={{ marginRight: 6, color: accent }}>{symbol}</span>{label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.textLt, marginTop: 2 }}>{desc}</div>
    </button>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
      padding: "4px 10px", borderRadius: 4, color: color, border: `1px solid ${color}55`, background: color + "11",
    }}>{label}</span>
  );
}

function RichText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((p) => p.split(/(\*\*[^*]+\*\*)/g));
  }, [text]);
  return (
    <div style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: "0.95rem", lineHeight: 1.75 }}>
      {parts.map((para, i) => (
        <p key={i} style={{ margin: "0 0 14px" }}>
          {para.map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} style={{ color: C.text, fontWeight: 600 }}>{seg.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{seg}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

function FbBtn({ active, onClick, emoji, label, accent }: { active: boolean; onClick: () => void; emoji: string; label: string; accent: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px", borderRadius: 8,
        border: `1px solid ${active ? accent : C.border}`,
        background: active ? accent + "22" : C.surfaceLo,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
      }}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: active ? accent : C.textMd, letterSpacing: "0.05em" }}>{label}</span>
    </button>
  );
}

/* ---------- DEEP DIVE ---------- */
function DeepDiveView({ termo, onClose }: { termo: string; onClose: () => void }) {
  const callDeep = useServerFn(deepDive);
  const [data, setData] = useState<null | Awaited<ReturnType<typeof callDeep>>>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useMemo(() => {
    setLoading(true);
    callDeep({ data: { termo } })
      .then((d) => setData(d))
      .catch((e: any) => setErr(e?.message ?? "Falha ao carregar compêndio"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  const q = encodeURIComponent(termo);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: C.bg,
      backgroundImage: `radial-gradient(ellipse at 50% -10%, rgba(255,122,58,0.15), transparent 50%), linear-gradient(${C.border}22 1px, transparent 1px), linear-gradient(90deg, ${C.border}22 1px, transparent 1px)`,
      backgroundSize: "auto, 44px 44px, 44px 44px",
      overflowY: "auto",
      animation: "slideIn 0.4s ease both",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={lionImg} alt="" width={48} height={48} style={{ width: 48, height: 48, filter: `drop-shadow(0 2px 12px ${C.glow})` }} />
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.24em", color: C.gold, textTransform: "uppercase" }}>
                compêndio avançado
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", marginTop: 2 }}>{termo}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11, color: C.textMd, letterSpacing: "0.1em" }}>
            ← voltar
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: C.borderHi }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${C.border})` }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, letterSpacing: "0.3em" }}>◆◆◆</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${C.border})` }} />
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" }}>
            <Spinner />
            <span style={{ fontFamily: FONT_MONO, color: C.textMd, fontSize: 12, letterSpacing: "0.12em" }}>consultando o oráculo<span style={{ color: C.ember }}>_</span></span>
          </div>
        )}

        {err && (
          <div style={{ background: C.surface, border: `1px solid ${C.danger}55`, padding: 16, borderRadius: 12, fontFamily: FONT_MONO, color: C.danger }}>
            ERR :: {err}
          </div>
        )}

        {data && (
          <>
            <DeepSection label="⊕ Exploração Completa">
              <RichText text={data.profundidade} />
            </DeepSection>
            {data.exemplo && (
              <DeepSection label="⊕ Exemplo Real" accent={C.ember}>
                <RichText text={data.exemplo} />
              </DeepSection>
            )}
            {data.analogia && (
              <DeepSection label="⊕ Analogia" accent={C.gold}>
                <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textMd, fontSize: 16, lineHeight: 1.65, margin: 0 }}>
                  {data.analogia}
                </p>
              </DeepSection>
            )}
            {data.relacionados.length > 0 && (
              <DeepSection label="⊕ Conceitos Relacionados">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {data.relacionados.map((r: string) => (
                    <a
                      key={r}
                      href={`https://www.google.com/search?q=${encodeURIComponent(r)}`}
                      target="_blank" rel="noreferrer"
                      style={{ padding: "6px 12px", borderRadius: 6, background: C.surfaceLo, border: `1px solid ${C.border}`, color: C.gold, fontFamily: FONT_MONO, fontSize: 11.5, textDecoration: "none", letterSpacing: "0.04em" }}
                    >{r}</a>
                  ))}
                </div>
              </DeepSection>
            )}
            <DeepSection label="⊕ Para Aprender Mais">
              <div style={{ display: "grid", gap: 10 }}>
                <LinkCard emoji="▶" title="YouTube" subtitle={`vídeos sobre "${termo}"`} href={`https://www.youtube.com/results?search_query=${q}`} />
                <LinkCard emoji="📖" title="Wikipedia PT" subtitle="artigo enciclopédico" href={`https://pt.wikipedia.org/wiki/Special:Search?search=${q}`} />
                <LinkCard emoji="🔎" title="Busca Avançada" subtitle="Google com tutorial" href={`https://www.google.com/search?q=${q}+tutorial`} />
                {data.docLink && (
                  <LinkCard emoji="📑" title="Documentação Oficial" subtitle="fonte primária" href={data.docLink} />
                )}
              </div>
            </DeepSection>
          </>
        )}
      </div>
    </div>
  );
}

function DeepSection({ label, accent, children }: { label: string; accent?: string; children: React.ReactNode }) {
  const color = accent ?? C.gold;
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.2em", color: color, textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ background: `linear-gradient(180deg, ${C.surface}, ${C.surfaceLo})`, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, boxShadow: `0 6px 20px ${C.shadow}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: color, opacity: 0.6 }} />
        {children}
      </div>
    </section>
  );
}

function LinkCard({ emoji, title, subtitle, href }: { emoji: string; title: string; subtitle: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 10,
      background: C.surfaceLo, border: `1px solid ${C.border}`,
      textDecoration: "none", color: C.text, transition: "all 0.2s",
    }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.text }}>{title}</div>
        <div style={{ fontFamily: FONT_MONO, color: C.textLt, fontSize: 11, marginTop: 2, letterSpacing: "0.04em" }}>{subtitle}</div>
      </div>
      <span style={{ fontFamily: FONT_MONO, color: C.ember }}>↗</span>
    </a>
  );
}