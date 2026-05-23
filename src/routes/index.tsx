import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { humanize, deepDive } from "@/lib/helion.functions";

export const Route = createFileRoute("/")({
  component: Helion,
});

/* ---------- DESIGN TOKENS ---------- */
const C = {
  bg: "#E4EEE0",
  card: "#F1F7EC",
  cardInner: "#EBF4E5",
  pista: "#6DAF67",
  pistaLt: "#93CA8D",
  pistaMd: "#BCDBBA",
  pistaDk: "#4A8544",
  pistaXl: "#DFF0DA",
  ochre: "#C49030",
  ochreLt: "#DDB85A",
  ochreDk: "#8E6818",
  ochrePl: "#F5EBC5",
  text: "#18201A",
  textMd: "#3A4C38",
  textLt: "#748C6C",
  border: "#AEBEA6",
  borderDk: "#7A8F72",
  rust: "#8B4020",
  shadow: "rgba(25,55,20,0.12)",
};

const FONT_TITLE = `'Special Elite', 'Courier New', monospace`;
const FONT_BODY = `'Lora', Georgia, serif`;
const FONT_MONO = `'Share Tech Mono', ui-monospace, monospace`;

/* ---------- ICONS ---------- */
function GearIcon({ size = 18, color = C.ochre, spin = true, reverse = false, opacity = 1, duration = 8 }: { size?: number; color?: string; spin?: boolean; reverse?: boolean; opacity?: number; duration?: number }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    opacity,
    animation: spin ? `spinGear ${duration}s linear infinite${reverse ? " reverse" : ""}` : undefined,
    display: "inline-block",
    flexShrink: 0,
  };
  return (
    <svg viewBox="0 0 24 24" style={style} fill="none" stroke={color} strokeWidth="1.6">
      <circle cx="12" cy="12" r="3.2" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 12 + Math.cos(a) * 5.5;
        const y1 = 12 + Math.sin(a) * 5.5;
        const x2 = 12 + Math.cos(a) * 9;
        const y2 = 12 + Math.sin(a) * 9;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round" />;
      })}
      <circle cx="12" cy="12" r="8" strokeOpacity="0.55" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  const color = active ? C.ochre : C.textLt;
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M6 9 C6 7 7.5 6 9.5 6 H22.5 C24.5 6 26 7.5 26 9.5 V18 C26 20 24.5 21.5 22.5 21.5 H14 L9 26 V21.5 H9.5 C7.5 21.5 6 20 6 18 Z" />
      <circle cx="12" cy="14" r="1.3" fill={color} stroke="none" />
      <circle cx="16" cy="14" r="1.3" fill={color} stroke="none" />
      <circle cx="20" cy="14" r="1.3" fill={color} stroke="none" />
    </svg>
  );
}

function CircuitIcon({ active }: { active: boolean }) {
  const color = active ? C.pistaDk : C.textLt;
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke={color} strokeWidth="1.8">
      <circle cx="16" cy="16" r="2.8" fill={color} stroke="none" />
      <line x1="16" y1="6" x2="16" y2="11" strokeLinecap="round" />
      <line x1="16" y1="21" x2="16" y2="26" strokeLinecap="round" />
      <line x1="6" y1="16" x2="11" y2="16" strokeLinecap="round" />
      <line x1="21" y1="16" x2="26" y2="16" strokeLinecap="round" />
      <circle cx="16" cy="5" r="1.6" />
      <circle cx="16" cy="27" r="1.6" />
      <circle cx="5" cy="16" r="1.6" />
      <circle cx="27" cy="16" r="1.6" />
      <path d="M4 4 L7 4 L7 7" strokeLinecap="round" />
      <path d="M28 28 L25 28 L25 25" strokeLinecap="round" />
    </svg>
  );
}

function HelionLogo({ size = 72 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="HELION">
      {/* sun rays */}
      {Array.from({ length: 18 }).map((_, i) => {
        const ang = (-90 + i * 20) * (Math.PI / 180);
        const isMain = i % 3 === 0;
        const isSecondary = i % 3 === 1;
        const inner = 33;
        const outer = isMain ? 50 : isSecondary ? 46 : 43;
        const x1 = 50 + Math.cos(ang) * inner;
        const y1 = 50 + Math.sin(ang) * inner;
        const x2 = 50 + Math.cos(ang) * outer;
        const y2 = 50 + Math.sin(ang) * outer;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isMain ? C.ochre : C.ochreLt}
            strokeWidth={isMain ? 3.2 : isSecondary ? 2 : 1.4}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="50" cy="50" r="34" fill="none" stroke={C.ochreLt} strokeWidth="0.6" strokeDasharray="2.2 1.5" opacity="0.75" />
      {/* ears */}
      <path d="M26 37 L20 22 L34 30 Z" fill={C.pistaMd} stroke={C.pistaDk} strokeWidth="1.4" />
      <path d="M74 37 L80 22 L66 30 Z" fill={C.pistaMd} stroke={C.pistaDk} strokeWidth="1.4" />
      <path d="M26 36 L23 27 L31 31 Z" fill={C.ochre} opacity="0.55" />
      <path d="M74 36 L77 27 L69 31 Z" fill={C.ochre} opacity="0.55" />
      {/* face */}
      <ellipse cx="50" cy="51" rx="28" ry="29" fill={C.card} stroke={C.pistaDk} strokeWidth="1.2" />
      <ellipse cx="50" cy="51" rx="28" ry="29" fill={C.pistaMd} opacity="0.5" />
      {/* gear on top */}
      <circle cx="50" cy="22" r="2.8" fill={C.ochre} />
      <line x1="44" y1="22" x2="47" y2="22" stroke={C.ochreLt} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="53" y1="22" x2="56" y2="22" stroke={C.ochreLt} strokeWidth="1.2" strokeLinecap="round" />
      {/* brows */}
      <path d="M32 43 Q37 38 43 41" stroke={C.pistaDk} strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <path d="M68 43 Q63 38 57 41" stroke={C.pistaDk} strokeWidth="2.3" fill="none" strokeLinecap="round" />
      {/* eyes */}
      {[38, 62].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={48} rx="4.2" ry="3.2" fill={C.text} />
          <circle cx={cx} cy={48} r="2.2" fill={C.ochreDk} />
          <circle cx={cx} cy={48} r="1.2" fill={C.text} />
          <circle cx={cx - 0.8} cy={47.2} r="0.5" fill="#ffffff" />
        </g>
      ))}
      {/* nose */}
      <line x1="50" y1="53" x2="50" y2="59" stroke={C.textMd} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M45 58 Q50 55 55 58 L50 63 Z" fill={C.ochre} stroke={C.ochreDk} strokeWidth="0.6" />
      {/* mouth */}
      <ellipse cx="50" cy="68" rx="5" ry="2" fill={C.textMd} opacity="0.45" />
      <path d="M45 66 Q50 71 55 66" stroke={C.textMd} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* whiskers */}
      <circle cx="36" cy="61" r="0.9" fill={C.pistaDk} opacity="0.5" />
      <circle cx="32" cy="63" r="0.7" fill={C.pistaDk} opacity="0.4" />
      <circle cx="64" cy="61" r="0.9" fill={C.pistaDk} opacity="0.5" />
      <circle cx="68" cy="63" r="0.7" fill={C.pistaDk} opacity="0.4" />
    </svg>
  );
}

function ClawMark({ position }: { position: "tl" | "br" }) {
  const isTL = position === "tl";
  const style: CSSProperties = {
    position: "fixed",
    [isTL ? "top" : "bottom"]: -20,
    [isTL ? "right" : "left"]: -20,
    transform: isTL ? "rotate(22deg)" : "rotate(-12deg)",
    width: 320,
    height: 320,
    zIndex: 0,
    pointerEvents: "none",
    animation: `clawPulse 9s ease-in-out infinite${isTL ? " 2s" : ""}`,
  };
  return (
    <svg viewBox="0 0 200 200" style={style} fill="none" stroke={C.pistaDk} strokeWidth="3" strokeLinecap="round">
      <path d="M40 20 Q30 90 50 170" />
      <path d="M100 10 Q90 90 110 180" />
      <path d="M160 25 Q150 95 170 175" />
    </svg>
  );
}

function Ornament() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: C.ochreLt }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${C.ochreLt})` }} />
      <GearIcon size={12} color={C.ochreLt} duration={10} />
      <span style={{ fontFamily: FONT_BODY, fontSize: 12 }}>◆</span>
      <GearIcon size={12} color={C.ochreLt} duration={10} reverse />
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${C.ochreLt})` }} />
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ position: "relative", width: 56, height: 56 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <GearIcon size={56} color={C.pistaLt} duration={6} />
      </div>
      <div style={{ position: "absolute", top: 14, left: 14 }}>
        <GearIcon size={28} color={C.ochreLt} duration={4} reverse />
      </div>
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
      radial-gradient(circle at 0% 0%, ${C.pistaMd}55, transparent 40%),
      radial-gradient(circle at 100% 100%, ${C.ochrePl}88, transparent 45%),
      repeating-linear-gradient(0deg, ${C.pistaMd}38 0 1px, transparent 1px 40px),
      repeating-linear-gradient(90deg, ${C.pistaMd}38 0 1px, transparent 1px 40px)
    `,
    color: C.text,
    fontFamily: FONT_BODY,
    position: "relative",
    overflowX: "hidden",
  };

  const container: CSSProperties = {
    maxWidth: 620,
    margin: "0 auto",
    padding: "48px 20px 80px",
    position: "relative",
    zIndex: 1,
  };

  const cardStyle: CSSProperties = {
    background: C.card,
    borderRadius: 26,
    padding: 28,
    boxShadow: `0 8px 32px ${C.shadow}, 0 1px 0 rgba(255,255,255,0.6) inset`,
    border: `1px solid ${C.border}`,
    position: "relative",
    overflow: "hidden",
    animation: "fadeUp 0.6s ease both",
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: "0.18em",
    color: C.textLt,
    textTransform: "uppercase",
    marginBottom: 8,
    display: "block",
  };

  const textareaStyle: CSSProperties = {
    width: "100%",
    minHeight: 64,
    background: C.cardInner,
    border: `1.5px solid ${termo ? C.pista : C.border}`,
    borderRadius: 14,
    padding: "12px 14px",
    fontFamily: FONT_BODY,
    fontSize: 16,
    color: C.text,
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  return (
    <div style={pageBg}>
      <style>{`
        @keyframes spinGear  { to { transform: rotate(360deg) } }
        @keyframes fadeUp    { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideIn   { from { opacity:0; transform:translateX(30px) } to { opacity:1; transform:translateX(0) } }
        @keyframes clawPulse { 0%,100% { opacity:0.03 } 50% { opacity:0.09 } }
        * { box-sizing: border-box; }
        ::placeholder { font-family: ${FONT_BODY}; font-style: italic; color: ${C.textLt}; }
        textarea:focus { border-color: ${C.pistaDk} !important; }
      `}</style>

      <ClawMark position="tl" />
      <ClawMark position="br" />

      <div style={container}>
        {/* HEADER */}
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.28em", color: C.textLt, textTransform: "uppercase", marginBottom: 18 }}>
            <GearIcon size={12} color={C.ochreLt} duration={10} />
            <span>Glossário de Tecnologia</span>
            <GearIcon size={12} color={C.ochreLt} duration={10} reverse />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
            <HelionLogo size={72} />
            <div style={{ textAlign: "left" }}>
              <h1 style={{ fontFamily: FONT_TITLE, fontSize: "3.6rem", margin: 0, lineHeight: 1, color: C.text, letterSpacing: "0.02em" }}>
                HELION<span style={{ color: C.ochre }}>.</span>
              </h1>
              <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textMd, marginTop: 4, fontSize: 15 }}>
                iluminando o conhecimento tech
              </p>
            </div>
          </div>
        </header>

        {/* MAIN CARD */}
        <div style={cardStyle}>
          {/* decorative gears */}
          <div style={{ position: "absolute", top: -12, right: -16, opacity: 0.08, pointerEvents: "none" }}>
            <GearIcon size={120} color={C.pistaDk} duration={20} />
          </div>
          <div style={{ position: "absolute", bottom: -10, left: -8, opacity: 0.07, pointerEvents: "none" }}>
            <GearIcon size={70} color={C.ochreDk} duration={16} reverse />
          </div>

          {/* TEXTAREA */}
          <div style={{ position: "relative" }}>
            <span style={labelStyle}>&gt;_ entrada :: termo · sigla · expressão</span>
            <textarea
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={onKey}
              placeholder="ex: API REST, machine learning, latência, Docker..."
              rows={2}
              style={textareaStyle}
            />
            {termo && (
              <span style={{ position: "absolute", right: 12, bottom: 8, fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, background: C.cardInner, padding: "2px 6px", borderRadius: 6 }}>
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
              padding: imageDataUrl ? 10 : 18,
              border: `1.5px dashed ${imageDataUrl ? C.ochre : dragOver ? C.pistaDk : C.border}`,
              borderRadius: 14,
              background: imageDataUrl ? C.ochrePl + "55" : C.cardInner,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: imageDataUrl ? "flex-start" : "center",
              fontFamily: FONT_MONO,
              fontSize: 12,
              color: imageDataUrl ? C.ochreDk : C.textLt,
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
                <img src={imageDataUrl} alt={imageName ?? ""} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.ochre}` }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imageName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setImageDataUrl(null); setImageName(null); }}
                  style={{ background: "transparent", border: "none", color: C.ochreDk, cursor: "pointer", fontSize: 18, fontFamily: FONT_MONO }}
                  aria-label="remover imagem"
                >✕</button>
              </>
            ) : (
              <span>[ img ] arraste uma captura de tela ou clique aqui</span>
            )}
          </div>

          <Ornament />

          {/* MODE BUTTONS */}
          <span style={labelStyle}>&gt;_ modo de explicação</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ModeCard
              active={modo === "casual"}
              onClick={() => setModo("casual")}
              accent={C.ochre}
              icon={<ChatIcon active={modo === "casual"} />}
              label="Casual"
              desc="sem formalidades, pra qualquer pessoa"
            />
            <ModeCard
              active={modo === "tecnica"}
              onClick={() => setModo("tecnica")}
              accent={C.pistaDk}
              icon={<CircuitIcon active={modo === "tecnica"} />}
              label="Técnica"
              desc="linguagem precisa, pra quem é da área"
            />
          </div>

          {/* LENGTH BUTTONS */}
          <div style={{ marginTop: 16 }}>
            <span style={labelStyle}>&gt;_ tamanho da resposta</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <LenButton active={tamanho === "curta"} onClick={() => setTamanho("curta")} accent={C.ochre} symbol="◈" label="Curta" desc="rápido e direto" />
              <LenButton active={tamanho === "longa"} onClick={() => setTamanho("longa")} accent={C.pista} symbol="◈◈" label="Longa" desc="com exemplos e contexto" />
            </div>
          </div>

          {/* HUMANIZE BUTTON */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              marginTop: 22,
              width: "100%",
              padding: "16px 24px",
              borderRadius: 999,
              border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: FONT_TITLE,
              fontSize: 17,
              letterSpacing: "0.08em",
              color: canSubmit ? "#fff" : C.textLt,
              background: canSubmit
                ? `linear-gradient(135deg, ${C.pista}, ${C.pistaDk} 55%, ${C.ochreDk})`
                : C.pistaMd + "55",
              boxShadow: canSubmit ? `0 6px 18px ${C.shadow}` : "none",
              transition: "transform 0.15s, box-shadow 0.2s",
            }}
          >
            {loading ? "⚙  processando..." : "✦  HUMANIZAR"}
          </button>
          {!canSubmit && (termo || imageDataUrl) && !loading && (
            <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", fontSize: 13, color: C.textLt, textAlign: "center", marginTop: 10 }}>
              selecione o modo e o tamanho para ativar ✦
            </p>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div style={{ ...cardStyle, marginTop: 20, display: "flex", alignItems: "center", gap: 18, justifyContent: "center" }}>
            <Spinner />
            <span style={{ fontFamily: FONT_TITLE, color: C.textLt, fontSize: 15 }}>compilando resposta...</span>
          </div>
        )}

        {/* FORA DE ESCOPO */}
        {foraEscopo && !loading && (
          <div style={{ ...cardStyle, marginTop: 20, background: C.ochrePl, border: `1.5px solid ${C.ochreLt}` }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: C.ochreDk, marginBottom: 4 }}>⚙️ 404</div>
            <h3 style={{ fontFamily: FONT_TITLE, color: C.ochreDk, fontSize: 22, margin: "4px 0 12px" }}>
              Arquivo não encontrado nos registros!
            </h3>
            <p style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 15, lineHeight: 1.6 }}>
              Este motor analisa somente território tech. Receitas de bolo, signos do zodíaco e fofoca de celebridade não constam no banco de dados. 🗂️
            </p>
            <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textLt, fontSize: 13, marginTop: 8 }}>
              Insira um jargão, sigla ou expressão de tecnologia.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 16, padding: "10px 18px", borderRadius: 999, border: `1px solid ${C.ochre}`, background: "transparent", color: C.ochreDk, fontFamily: FONT_MONO, cursor: "pointer" }}
            >← tentar novamente</button>
          </div>
        )}

        {/* ERROR */}
        {erro && !loading && (
          <div style={{ ...cardStyle, marginTop: 20, background: "#FBE7D6", border: `1px solid ${C.rust}55` }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.rust }}>
              ERR :: {erro}
            </span>
          </div>
        )}

        {/* RESULTADO */}
        {resposta && !loading && (
          <div style={{ ...cardStyle, marginTop: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge color={modo === "casual" ? C.ochre : C.pistaDk} label={modo === "casual" ? "casual" : "técnica"} />
              <Badge color={C.textLt} label={tamanho === "curta" ? "curta" : "longa"} />
            </div>
            <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
            <RichText text={resposta} />
            <Ornament />
            <span style={labelStyle}>&gt;_ sua avaliação</span>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <FbBtn active={feedback === "good"} onClick={() => setFeedback("good")} emoji="👍" label="iluminado!" accent={C.pista} />
              <FbBtn active={feedback === "meh"} onClick={() => setFeedback("meh")} emoji="😐" label="mais ou menos" accent={C.ochreLt} />
              <FbBtn active={feedback === "bad"} onClick={() => setFeedback("bad")} emoji="👎" label="não ajudou" accent={C.rust} />
            </div>
            {feedback === "good" && (
              <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.pistaDk, textAlign: "center", marginTop: 10, fontSize: 13 }}>
                obrigado pelo retorno, a engrenagem agradece ⚙
              </p>
            )}
            {(feedback === "bad" || feedback === "meh") && (
              <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.rust, textAlign: "center", marginTop: 10, fontSize: 13 }}>
                peço perdão ao oráculo. tente outro modo de explicação.
              </p>
            )}

            <button
              onClick={() => setDeepOpen(true)}
              style={{
                marginTop: 20, width: "100%", padding: "14px 18px", borderRadius: 999,
                border: `1.5px solid ${C.ochre}`,
                background: `linear-gradient(135deg, ${C.ochrePl}, ${C.card})`,
                color: C.ochreDk, fontFamily: FONT_TITLE, fontSize: 15, letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >⊕ Abrir Compêndio Avançado ↗</button>
            <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textLt, fontSize: 12, textAlign: "center", marginTop: 6 }}>
              explicações aprofundadas, analogias, links e conceitos relacionados
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 14, borderTop: `1px dashed ${C.border}`, fontFamily: FONT_MONO, fontSize: 10, color: C.textLt, letterSpacing: "0.1em" }}>
              <span>helion · claude engine</span>
              <button onClick={reset} style={{ background: "transparent", border: "none", fontFamily: FONT_MONO, color: C.pistaDk, cursor: "pointer", fontSize: 11 }}>
                ← nova busca
              </button>
            </div>
          </div>
        )}
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
        borderRadius: 18,
        border: `1.5px solid ${active ? accent : C.border}`,
        background: active ? `linear-gradient(135deg, ${accent}22, ${C.card})` : C.cardInner,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        transition: "all 0.2s",
      }}
    >
      {active && (
        <span style={{ position: "absolute", top: 8, right: 10, width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: active ? accent + "22" : C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontFamily: FONT_TITLE, fontSize: 17, color: active ? accent : C.text }}>{label}</div>
          <div style={{ fontFamily: FONT_BODY, fontStyle: "italic", fontSize: 11.5, color: C.textLt, marginTop: 2 }}>{desc}</div>
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
        borderRadius: 999,
        border: `1.5px solid ${active ? accent : C.border}`,
        background: active ? accent + "22" : C.cardInner,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        textAlign: "center",
        boxShadow: active ? `0 4px 12px ${accent}33` : "none",
        transition: "all 0.2s",
      }}
    >
      <div style={{ fontFamily: FONT_TITLE, fontSize: 15, color: active ? accent : C.text }}>
        {symbol} {label}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontStyle: "italic", fontSize: 11.5, color: C.textLt }}>{desc}</div>
    </button>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
      padding: "4px 10px", borderRadius: 999, color: color, border: `1px solid ${color}55`, background: color + "11",
    }}>{label}</span>
  );
}

function RichText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((p) => p.split(/(\*\*[^*]+\*\*)/g));
  }, [text]);
  return (
    <div style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: "0.95rem", lineHeight: 1.9 }}>
      {parts.map((para, i) => (
        <p key={i} style={{ margin: "0 0 14px" }}>
          {para.map((seg, j) =>
            seg.startsWith("**") && seg.endsWith("**") ? (
              <strong key={j} style={{ color: C.text }}>{seg.slice(2, -2)}</strong>
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
        padding: "10px 14px", borderRadius: 999,
        border: `1.5px solid ${active ? accent : C.border}`,
        background: active ? accent + "22" : C.cardInner,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontFamily: FONT_BODY, fontStyle: "italic", fontSize: 13, color: active ? accent : C.textMd }}>{label}</span>
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
      background: `linear-gradient(180deg, ${C.bg}, ${C.pistaXl})`,
      overflowY: "auto",
      animation: "slideIn 0.45s ease both",
    }}>
      <ClawMark position="tl" />
      <ClawMark position="br" />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <HelionLogo size={42} />
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.2em", color: C.textLt, textTransform: "uppercase" }}>
                Compêndio Avançado
              </div>
              <div style={{ fontFamily: FONT_TITLE, fontSize: 24, color: C.text }}>{termo}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.card, border: `1px solid ${C.border}`, padding: "10px 16px", borderRadius: 999, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 12, color: C.textMd }}>
            ← Voltar
          </button>
        </div>
        <Ornament />

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" }}>
            <Spinner />
            <span style={{ fontFamily: FONT_TITLE, color: C.textLt }}>consultando o oráculo profundo...</span>
          </div>
        )}

        {err && (
          <div style={{ background: "#FBE7D6", border: `1px solid ${C.rust}55`, padding: 16, borderRadius: 14, fontFamily: FONT_MONO, color: C.rust }}>
            ERR :: {err}
          </div>
        )}

        {data && (
          <>
            <DeepSection label="⊕ Exploração Completa" bg={C.card}>
              <RichText text={data.profundidade} />
            </DeepSection>
            {data.exemplo && (
              <DeepSection label="⊕ Exemplo Real" bg={C.ochrePl}>
                <RichText text={data.exemplo} />
              </DeepSection>
            )}
            {data.analogia && (
              <DeepSection label="⊕ Analogia" bg={C.pistaXl}>
                <p style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textMd, fontSize: 16, lineHeight: 1.7, margin: 0 }}>
                  {data.analogia}
                </p>
              </DeepSection>
            )}
            {data.relacionados.length > 0 && (
              <DeepSection label="⊕ Conceitos Relacionados" bg={C.card}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {data.relacionados.map((r) => (
                    <a
                      key={r}
                      href={`https://www.google.com/search?q=${encodeURIComponent(r)}`}
                      target="_blank" rel="noreferrer"
                      style={{ padding: "6px 12px", borderRadius: 999, background: C.pistaXl, border: `1px solid ${C.pistaMd}`, color: C.pistaDk, fontFamily: FONT_MONO, fontSize: 12, textDecoration: "none" }}
                    >{r}</a>
                  ))}
                </div>
              </DeepSection>
            )}
            <DeepSection label="⊕ Para Aprender Mais" bg={C.card}>
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

function DeepSection({ label, bg, children }: { label: string; bg: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", color: C.ochreDk, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ background: bg, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, boxShadow: `0 4px 16px ${C.shadow}` }}>
        {children}
      </div>
    </section>
  );
}

function LinkCard({ emoji, title, subtitle, href }: { emoji: string; title: string; subtitle: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 14,
      background: C.cardInner, border: `1px solid ${C.border}`,
      textDecoration: "none", color: C.text, transition: "all 0.2s",
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_TITLE, fontSize: 14 }}>{title}</div>
        <div style={{ fontFamily: FONT_BODY, fontStyle: "italic", color: C.textLt, fontSize: 12 }}>{subtitle}</div>
      </div>
      <span style={{ fontFamily: FONT_MONO, color: C.ochre }}>↗</span>
    </a>
  );
}