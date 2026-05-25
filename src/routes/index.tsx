import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { humanize, deepDive } from "@/lib/helion.functions";

export const Route = createFileRoute("/")({
  component: Helion,
});

/* ---------- DESIGN TOKENS — Enterprise Deep Dark ---------- */
const C = {
  bg: "#0A0A0A",
  bg2: "#0F0F10",
  surface: "#131316",
  surfaceHi: "#1A1A1F",
  surfaceLo: "#0E0E11",
  border: "#1F1F24",
  borderHi: "#2A2A31",
  text: "#F5F5F7",
  textMd: "#A1A1AA",
  textLt: "#71717A",
  amber: "#F59E0B",
  amberHi: "#FBBF24",
  amberDk: "#B45309",
  amberSoft: "rgba(245,158,11,0.12)",
  glow: "rgba(245,158,11,0.22)",
  shadow: "rgba(0,0,0,0.6)",
  danger: "#EF4444",
};

const FONT_DISPLAY = `'Inter', system-ui, -apple-system, sans-serif`;
const FONT_BODY = `'Inter', system-ui, -apple-system, sans-serif`;
const FONT_MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`;

/* ---------- LOGO: HELION wordmark with O as abstract lion silhouette ---------- */
function HelionWordmark({ size = 56 }: { size?: number }) {
  // Size is the cap-height of the wordmark in px
  const letterStyle: CSSProperties = {
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: "-0.04em",
    color: C.text,
    display: "inline-flex",
    alignItems: "center",
  };
  const oSize = size * 0.92;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 0 }} aria-label="Helion">
      <span style={letterStyle}>Heli</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: oSize,
          height: oSize,
          marginLeft: size * 0.02,
          marginRight: size * 0.02,
          position: "relative",
        }}
      >
        <svg viewBox="0 0 100 100" width={oSize} height={oSize} aria-hidden>
          {/* outer ring forming the O */}
          <circle cx="50" cy="50" r="44" fill="none" stroke={C.text} strokeWidth="8" />
          {/* abstract lion silhouette inside — minimal geometric mane + muzzle */}
          <g fill={C.amber}>
            {/* triangular ears */}
            <path d="M32 36 L38 26 L42 36 Z" />
            <path d="M68 36 L62 26 L58 36 Z" />
            {/* mane crown: subtle spiked arc */}
            <path d="M28 44 L34 38 L40 44 L46 36 L50 44 L54 36 L60 44 L66 38 L72 44 L70 52 L30 52 Z" opacity="0.9" />
            {/* muzzle / face block */}
            <rect x="38" y="54" width="24" height="14" rx="3" />
            {/* eyes (negative space via bg color) */}
            <circle cx="44" cy="60" r="1.6" fill={C.bg} />
            <circle cx="56" cy="60" r="1.6" fill={C.bg} />
          </g>
        </svg>
      </span>
      <span style={letterStyle}>n</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ position: "relative", width: 36, height: 36 }}>
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
      setErro(e?.message ?? "Falha na requisição.");
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
    color: C.text,
    fontFamily: FONT_BODY,
    position: "relative",
    overflowX: "hidden",
  };

  const container: CSSProperties = {
    maxWidth: 680,
    margin: "0 auto",
    padding: "56px 24px 96px",
    position: "relative",
    zIndex: 1,
  };

  const cardStyle: CSSProperties = {
    background: C.surface,
    borderRadius: 14,
    padding: 32,
    border: `1px solid ${C.border}`,
    position: "relative",
    animation: "fadeUp 0.45s ease both",
  };

  const labelStyle: CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: "0.14em",
    color: C.textLt,
    textTransform: "uppercase",
    marginBottom: 12,
    display: "block",
    fontWeight: 500,
  };

  const textareaStyle: CSSProperties = {
    width: "100%",
    minHeight: 72,
    background: C.bg,
    border: `1px solid ${termo ? C.amber : C.border}`,
    borderRadius: 10,
    padding: "14px 16px",
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 1.5,
    color: C.text,
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box",
    boxShadow: termo ? `0 0 0 3px ${C.amberSoft}` : "none",
  };

  return (
    <div style={pageBg}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        html, body { background: ${C.bg}; }
        ::placeholder { color: ${C.textLt}; opacity: 0.7; }
        textarea:focus { border-color: ${C.amber} !important; box-shadow: 0 0 0 3px ${C.amberSoft} !important; }
        button:not(:disabled):hover { filter: brightness(1.08); }
        a:hover { color: ${C.amberHi}; }
      `}</style>

      <div style={container}>
        {/* HEADER */}
        <header style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <HelionWordmark size={64} />
          </div>
          <p
            style={{
              fontFamily: FONT_BODY,
              color: C.textMd,
              margin: 0,
              fontSize: 15,
              fontWeight: 400,
              letterSpacing: "-0.005em",
            }}
          >
            Traduzindo o técnico, iluminando o humano.
          </p>
        </header>

        {/* MAIN CARD */}
        <div style={cardStyle}>
          {/* TEXTAREA */}
          <div style={{ position: "relative" }}>
            <span style={labelStyle}>Termo, sigla ou expressão</span>
            <textarea
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={onKey}
              placeholder="API REST, machine learning, latência, Docker…"
              rows={2}
              style={textareaStyle}
            />
          </div>

          {/* UPLOAD ZONE */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              marginTop: 14,
              padding: imageDataUrl ? 10 : 14,
              border: `1px dashed ${imageDataUrl ? C.amber : dragOver ? C.amberHi : C.border}`,
              borderRadius: 10,
              background: imageDataUrl ? C.amberSoft : C.bg,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: imageDataUrl ? "flex-start" : "center",
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: imageDataUrl ? C.amberHi : C.textLt,
              transition: "all 0.15s",
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
                <img
                  src={imageDataUrl}
                  alt={imageName ?? ""}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: `1px solid ${C.amber}`,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {imageName}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageDataUrl(null);
                    setImageName(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.amber,
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                  aria-label="remover imagem"
                >
                  ✕
                </button>
              </>
            ) : (
              <span>Anexar captura de tela (opcional)</span>
            )}
          </div>

          {/* MODE BUTTONS */}
          <div style={{ marginTop: 28 }}>
            <span style={labelStyle}>Modo de explicação</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <OptionButton
                active={modo === "casual"}
                onClick={() => setModo("casual")}
                label="Casual"
                desc="Linguagem cotidiana"
              />
              <OptionButton
                active={modo === "tecnica"}
                onClick={() => setModo("tecnica")}
                label="Técnica"
                desc="Precisão para a área"
              />
            </div>
          </div>

          {/* LENGTH BUTTONS */}
          <div style={{ marginTop: 20 }}>
            <span style={labelStyle}>Tamanho da resposta</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <OptionButton
                active={tamanho === "curta"}
                onClick={() => setTamanho("curta")}
                label="Curta"
                desc="Definição direta"
              />
              <OptionButton
                active={tamanho === "longa"}
                onClick={() => setTamanho("longa")}
                label="Longa"
                desc="Com exemplos e contexto"
              />
            </div>
          </div>

          {/* SUBMIT */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              marginTop: 28,
              width: "100%",
              padding: "14px 24px",
              borderRadius: 10,
              border: `1px solid ${canSubmit ? C.amber : C.border}`,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.02em",
              color: canSubmit ? "#0A0A0A" : C.textLt,
              background: canSubmit ? C.amber : C.surfaceHi,
              transition: "all 0.15s",
            }}
          >
            {loading ? "Processando…" : "Humanizar"}
          </button>
          {!canSubmit && (termo || imageDataUrl) && !loading && (
            <p
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: C.textLt,
                textAlign: "center",
                marginTop: 12,
              }}
            >
              Selecione modo e tamanho para ativar
            </p>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div
            style={{
              ...cardStyle,
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 16,
              justifyContent: "center",
              padding: 28,
            }}
          >
            <Spinner />
            <span style={{ fontFamily: FONT_MONO, color: C.textMd, fontSize: 13 }}>
              Processando
            </span>
          </div>
        )}

        {/* FORA DE ESCOPO */}
        {foraEscopo && !loading && (
          <div style={{ ...cardStyle, marginTop: 20, borderColor: C.amber }}>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                color: C.amber,
                letterSpacing: "0.14em",
                marginBottom: 6,
              }}
            >
              FORA DE ESCOPO
            </div>
            <h3
              style={{
                fontFamily: FONT_DISPLAY,
                color: C.text,
                fontSize: 20,
                margin: "4px 0 12px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              Termo fora do domínio técnico.
            </h3>
            <p style={{ fontFamily: FONT_BODY, color: C.textMd, fontSize: 14, lineHeight: 1.6 }}>
              Este sistema processa apenas tecnologia. Tente um termo, sigla ou expressão da
              área.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.textMd,
                fontFamily: FONT_BODY,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ERROR */}
        {erro && !loading && (
          <div style={{ ...cardStyle, marginTop: 20, borderColor: C.danger }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.danger }}>
              Erro: {erro}
            </span>
          </div>
        )}

        {/* RESULTADO */}
        {resposta && !loading && (
          <div style={{ ...cardStyle, marginTop: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge label={modo === "casual" ? "Casual" : "Técnica"} />
              <Badge label={tamanho === "curta" ? "Curta" : "Longa"} />
            </div>
            <div style={{ height: 1, background: C.border, margin: "20px 0" }} />
            <RichText text={resposta} />

            {/* COMPÊNDIO BUTTON */}
            <button
              onClick={() => setDeepOpen(true)}
              style={{
                marginTop: 28,
                width: "100%",
                padding: "13px 18px",
                borderRadius: 10,
                border: `1px solid ${C.amber}`,
                background: "transparent",
                color: C.amber,
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Abrir Compêndio Avançado
            </button>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: C.textLt,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Analogias, exemplos e conceitos relacionados.
            </p>

            {/* GHOST FEEDBACK FOOTER */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                <GhostFb active={feedback === "good"} onClick={() => setFeedback("good")} label="Útil" />
                <GhostFb active={feedback === "meh"} onClick={() => setFeedback("meh")} label="Parcial" />
                <GhostFb active={feedback === "bad"} onClick={() => setFeedback("bad")} label="Impreciso" />
              </div>
              <button
                onClick={reset}
                style={{
                  background: "transparent",
                  border: "none",
                  fontFamily: FONT_BODY,
                  color: C.textMd,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: "6px 4px",
                }}
              >
                Nova consulta
              </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer
          style={{
            marginTop: 56,
            textAlign: "center",
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: C.textLt,
            letterSpacing: "0.05em",
          }}
        >
          Helion · {new Date().getFullYear()}
        </footer>
      </div>

      {deepOpen && resposta && (
        <DeepDiveView termo={termo || "imagem enviada"} onClose={() => setDeepOpen(false)} />
      )}
    </div>
  );
}

/* ---------- SUB-COMPONENTS ---------- */
function OptionButton({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: 10,
        border: `1px solid ${active ? C.amber : C.border}`,
        background: active ? C.amberSoft : C.bg,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 600,
          fontSize: 14,
          color: active ? C.amberHi : C.text,
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.textLt, marginTop: 3 }}>
        {desc}
      </div>
    </button>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "4px 9px",
        borderRadius: 4,
        color: C.textMd,
        border: `1px solid ${C.border}`,
        background: C.bg,
      }}
    >
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
              <strong key={j} style={{ color: C.text, fontWeight: 600 }}>
                {seg.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{seg}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function GhostFb({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: active ? C.amberSoft : "transparent",
        color: active ? C.amberHi : C.textMd,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: 500,
        transition: "all 0.12s",
      }}
    >
      {label}
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: C.bg,
        overflowY: "auto",
        animation: "slideIn 0.3s ease both",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "40px 24px 96px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: "0.14em",
                color: C.amber,
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Compêndio Avançado
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 28,
                fontWeight: 600,
                color: C.text,
                letterSpacing: "-0.025em",
                marginTop: 4,
              }}
            >
              {termo}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              padding: "10px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: C.textMd,
            }}
          >
            Voltar
          </button>
        </div>
        <div style={{ height: 1, background: C.border, margin: "28px 0" }} />

        {loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              padding: "60px 0",
            }}
          >
            <Spinner />
            <span style={{ fontFamily: FONT_MONO, color: C.textMd, fontSize: 12 }}>
              Processando
            </span>
          </div>
        )}

        {err && (
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.danger}55`,
              padding: 16,
              borderRadius: 10,
              fontFamily: FONT_MONO,
              color: C.danger,
            }}
          >
            Erro: {err}
          </div>
        )}

        {data && (
          <>
            <DeepSection label="Exploração completa">
              <RichText text={data.profundidade} />
            </DeepSection>
            {data.exemplo && (
              <DeepSection label="Exemplo real">
                <RichText text={data.exemplo} />
              </DeepSection>
            )}
            {data.analogia && (
              <DeepSection label="Analogia">
                <p
                  style={{
                    fontFamily: FONT_BODY,
                    fontStyle: "italic",
                    color: C.textMd,
                    fontSize: 16,
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {data.analogia}
                </p>
              </DeepSection>
            )}
            {data.relacionados.length > 0 && (
              <DeepSection label="Conceitos relacionados">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {data.relacionados.map((r: string) => (
                    <a
                      key={r}
                      href={`https://www.google.com/search?q=${encodeURIComponent(r)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        color: C.amber,
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        textDecoration: "none",
                      }}
                    >
                      {r}
                    </a>
                  ))}
                </div>
              </DeepSection>
            )}
            <DeepSection label="Para aprender mais">
              <div style={{ display: "grid", gap: 10 }}>
                <LinkCard
                  title="YouTube"
                  subtitle={`Vídeos sobre "${termo}"`}
                  href={`https://www.youtube.com/results?search_query=${q}`}
                />
                <LinkCard
                  title="Wikipédia"
                  subtitle="Artigo enciclopédico"
                  href={`https://pt.wikipedia.org/wiki/Special:Search?search=${q}`}
                />
                <LinkCard
                  title="Busca avançada"
                  subtitle="Google + tutorial"
                  href={`https://www.google.com/search?q=${q}+tutorial`}
                />
                {data.docLink && (
                  <LinkCard
                    title="Documentação oficial"
                    subtitle="Fonte primária"
                    href={data.docLink}
                  />
                )}
              </div>
            </DeepSection>
          </>
        )}
      </div>
    </div>
  );
}

function DeepSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: "0.14em",
          color: C.textLt,
          textTransform: "uppercase",
          marginBottom: 12,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 22,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function LinkCard({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 10,
        background: C.bg,
        border: `1px solid ${C.border}`,
        textDecoration: "none",
        color: C.text,
        transition: "all 0.15s",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.text }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT_BODY, color: C.textLt, fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <span style={{ fontFamily: FONT_MONO, color: C.amber }}>→</span>
    </a>
  );
}