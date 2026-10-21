import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { BedrockRuntimeClient, ConverseCommand, type ContentBlock, type ImageFormat } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { z } from "zod";
import { FriendlyError, bump, clientIp, event, hashIp, newId, notify, nowSec, put, rateLimit, today, DAY } from "./backend.server";

const MODEL = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-lite-v1:0";
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 3000, requestTimeout: 20000 }),
});

const MAX_IMAGE_CHARS = 2_000_000; // ~1.5 MB binary as base64 data URL
const zModo = z.enum(["casual", "tecnica"]);
const zTamanho = z.enum(["curta", "longa"]);
const zAnalise = z.enum(["padrao", "codigo"]);
const zImage = z.string().max(MAX_IMAGE_CHARS, "Imagem grande demais (máx. ~1,5 MB).")
  .regex(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i, "Formato de imagem não suportado.");

const HumanizeSchema = z.object({
  termo: z.string().trim().max(200, "Use no máximo 200 caracteres."),
  modo: zModo, tamanho: zTamanho, analise: zAnalise.default("padrao"),
  imageDataUrl: zImage.nullish(),
  sessionId: z.string().max(64).optional(),
}).refine((d) => d.termo.length > 0 || !!d.imageDataUrl, "Digite um termo ou anexe uma imagem.")
  .refine((d) => d.analise !== "codigo" || !!d.imageDataUrl, "A análise de código precisa de uma imagem.");

const DeepDiveSchema = z.object({
  termo: z.string().trim().min(1).max(200),
  analise: zAnalise.default("padrao"),
  contextoCodigo: z.string().max(1200).nullish(),
  sessionId: z.string().max(64).optional(),
});

function reqIpHash() {
  return hashIp(clientIp((n) => getRequestHeader(n)));
}

/** Friendly pt-BR message to the client; detail only in logs/telemetry. */
async function guarded<T>(fn: string, sessionId: string | undefined, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const ipHash = reqIpHash();
  try {
    await rateLimit(ipHash, "ai", 10);
    const out = await run();
    void event("ai", { fn, ms: Date.now() - t0, sessionId, ipHash });
    return out;
  } catch (e) {
    const err = e as Error;
    if (err instanceof FriendlyError) { void event("ratelimit", { fn, ipHash }); throw new Error(err.message); }
    console.error(`[${fn}]`, err?.name, err?.message);
    void event("error", { fn, name: err?.name, msg: String(err?.message).slice(0, 300), ms: Date.now() - t0, sessionId, ipHash });
    const msg = err?.name === "ThrottlingException" || err?.name === "ServiceQuotaExceededException"
      ? "Nosso motor de IA está ocupado agora. Tente novamente em alguns segundos."
      : err?.name === "TimeoutError" || /timeout/i.test(err?.message ?? "")
      ? "A resposta demorou mais que o esperado. Tente novamente."
      : err?.name === "ValidationException"
      ? "Não consegui processar essa entrada (a imagem pode estar ilegível ou grande demais)."
      : "Algo deu errado ao gerar a explicação. Tente novamente em instantes.";
    throw new Error(msg);
  }
}

type Mode = "casual" | "tecnica";
type Length = "curta" | "longa";
type Analise = "padrao" | "codigo";

interface HumanizeInput {
  termo: string;
  modo: Mode;
  tamanho: Length;
  imageDataUrl?: string | null;
  analise?: Analise;
}

function toneText(modo: Mode) {
  return modo === "casual"
    ? "linguagem casual e acessível, como um amigo apaixonado por tech explicando"
    : "linguagem técnica e precisa, própria para profissionais de TI";
}

function sizeText(tamanho: Length) {
  return tamanho === "curta"
    ? "concisa, até 3 parágrafos, direto ao ponto"
    : "aprofundada, com 4 a 6 parágrafos, analogias e exemplos";
}

function systemPrompt(modo: Mode, tamanho: Length, analise: Analise) {
  if (analise === "codigo") {
    return `Você é um mentor sênior de programação. A entrada é uma imagem contendo código-fonte. Sua tarefa:

1. Identifique a LINGUAGEM de programação na imagem (ex.: Python, JavaScript, Go, SQL, Bash…). Comece a resposta exatamente assim:
**Linguagem detectada:** <nome da linguagem>

2. Explique o PROPÓSITO geral do trecho (1 parágrafo).

3. Faça uma análise LINHA A LINHA. Para cada linha relevante, mostre o trecho em \`código\` e explique de forma aprofundada o que ela faz, incluindo o significado de comandos, operadores, símbolos (\`=>\`, \`::\`, \`->\`, \`&&\`, \`*\`, \`&\`, etc.), palavras-chave e estruturas de controle.

4. Encerre com **Boas práticas / observações** (1 parágrafo) sobre o que poderia ser melhorado ou pontos de atenção.

REGRAS:
- Português brasileiro, tom: ${toneText(modo)}.
- Extensão: ${sizeText(tamanho)}, mas NUNCA pule a análise linha a linha.
- Se a imagem NÃO contiver código de programação, responda APENAS com: {"fora_de_escopo":true}
- Texto puro com **negrito** para destaque; sem markdown com #; pode usar \`crase\` para trechos curtos de código.`;
  }
  return `Você é um especialista apaixonado em tecnologia. Responde APENAS sobre tecnologia, computação, programação, hardware, software, internet, redes, segurança, IA e afins.

REGRA ABSOLUTA: se o termo/imagem NÃO for de tecnologia, responda SOMENTE com o JSON exato: {"fora_de_escopo":true}

Se for sobre tecnologia:
- Português brasileiro
- Tom: ${toneText(modo)}
- Extensão: ${sizeText(tamanho)}
- Estilo OBRIGATÓRIO: fala fluida, humanizada, didática — como uma conversa inteligente entre amigos. Sem listas com bullet points. Prosa contínua e envolvente.
- Não repita o nome do termo como título no início.
- Expanda siglas naturalmente dentro da explicação.
- Responda em texto puro (sem JSON, sem markdown com #). Pode usar **negrito** para destaque.`;
}

// Accepts the OpenAI-style chat body used below and sends it via Bedrock Converse.
async function callGateway(body: { max_tokens?: number; messages: { role: string; content: any }[] }): Promise<string> {
  const system = body.messages.filter((m) => m.role === "system").map((m) => ({ text: String(m.content) }));
  const messages = body.messages.filter((m) => m.role !== "system").map((m) => {
    const parts = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    const content: ContentBlock[] = parts.map((p: any) => {
      if (p.type !== "image_url") return { text: p.text };
      const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(p.image_url.url);
      if (!match) throw new Error("Formato de imagem não suportado (use PNG, JPEG, WEBP ou GIF).");
      const format = match[1].toLowerCase().replace("jpg", "jpeg") as ImageFormat;
      return { image: { format, source: { bytes: Buffer.from(match[2], "base64") } } };
    });
    return { role: m.role as "user" | "assistant", content };
  });
  const res = await bedrock.send(new ConverseCommand({
    modelId: MODEL, system, messages,
    inferenceConfig: { maxTokens: body.max_tokens ?? 1200 },
  }));
  return res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
}

export const humanize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => HumanizeSchema.parse(d))
  .handler(({ data }) => guarded("humanize", data.sessionId, async () => {
    const userContent: any[] = [];
    const isCode = data.analise === "codigo" && !!data.imageDataUrl;
    const userText = isCode
      ? `Analise o código presente nesta imagem conforme as instruções do sistema (linguagem, propósito, linha a linha, boas práticas).${data.termo ? ` Contexto do usuário: "${data.termo}".` : ""}`
      : data.imageDataUrl
      ? `Identifique e explique os jargões, siglas ou expressões técnicas presentes nesta imagem.${data.termo ? ` Contexto adicional do usuário: "${data.termo}".` : ""}`
      : `Explique o seguinte termo/sigla/expressão de tecnologia: "${data.termo}"`;
    userContent.push({ type: "text", text: userText });
    if (data.imageDataUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: data.imageDataUrl },
      });
    }

    const content = await callGateway({
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt(data.modo, data.tamanho, data.analise ?? "padrao") },
        { role: "user", content: userContent },
      ],
    });

    const trimmed = content.trim();
    if (trimmed.includes('"fora_de_escopo"') && trimmed.includes("true")) {
      void bump(`METRIC#${today().slice(0, 7)}`, `humanize#${data.modo}#${data.tamanho}#${data.analise}#fora`);
      return { foraDeEscopo: true as const, requestId: newId() };
    }
    void bump(`METRIC#${today().slice(0, 7)}`, `humanize#${data.modo}#${data.tamanho}#${data.analise}${data.imageDataUrl ? "#img" : ""}`);
    return { foraDeEscopo: false as const, texto: trimmed, requestId: newId() };
  }));

interface DeepDiveInput {
  termo: string;
  analise?: Analise;
  contextoCodigo?: string | null;
}

const DEEP_SYSTEM_PADRAO = `Você é um especialista em tecnologia. Para o termo informado, responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem texto extra) com este formato exato:
{
  "profundidade": "3-5 parágrafos detalhados sobre o tema",
  "exemplo": "exemplo real em 1-2 parágrafos",
  "analogia": "analogia criativa em 1-2 frases",
  "relacionados": ["conceito1","conceito2","conceito3","conceito4"],
  "docLink": "URL da documentação oficial ou null"
}
Em português brasileiro. Prosa fluida, sem listas com bullets dentro do texto. Se não houver documentação oficial clara, use null no docLink (sem aspas).`;

const DEEP_SYSTEM_CODIGO = `Você é um mentor sênior de programação. Receberá a LINGUAGEM detectada (e opcionalmente o uso/propósito do trecho analisado). Responda EXCLUSIVAMENTE com JSON válido (sem markdown, sem texto extra) neste formato exato:
{
  "profundidade": "3-5 parágrafos detalhados sobre a linguagem detectada e sobre o uso específico do código analisado, conectando os dois",
  "exemplo": "exemplo de código real comentado em 1-2 parágrafos, ilustrando o mesmo uso",
  "analogia": "analogia criativa em 1-2 frases",
  "relacionados": ["conceito1","conceito2","conceito3","conceito4"],
  "docLink": "URL da documentação oficial da linguagem ou null",
  "videos": [{"titulo":"...","url":"https://www.youtube.com/results?search_query=..."}],
  "artigos": [{"titulo":"...","url":"https://..."}],
  "exemplosLinks": [{"titulo":"...","url":"https://..."}]
}
Em português brasileiro. Em videos/artigos/exemplosLinks, inclua 3 itens cada, COBRINDO TANTO a linguagem detectada QUANTO o uso específico do trecho. Prefira fontes confiáveis (documentação oficial, MDN, DevDocs, freeCodeCamp, GitHub, Real Python, etc.). Use URLs reais sempre que possível; quando não tiver certeza, use buscas no formato "https://www.google.com/search?q=..." ou "https://www.youtube.com/results?search_query=...".`;

export const deepDive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeepDiveSchema.parse(d))
  .handler(({ data }) => guarded("deepDive", data.sessionId, async () => {
    void bump(`METRIC#${today().slice(0, 7)}`, `deepdive#${data.analise}`);
    const isCode = data.analise === "codigo";
    const content = await callGateway({
      max_tokens: isCode ? 2400 : 1800,
      messages: [
        { role: "system", content: isCode ? DEEP_SYSTEM_CODIGO : DEEP_SYSTEM_PADRAO },
        {
          role: "user",
          content: isCode
            ? `Linguagem/termo: ${data.termo}.${data.contextoCodigo ? ` Contexto do código analisado: ${data.contextoCodigo}` : ""}`
            : `Termo: ${data.termo}`,
        },
      ],
    });
    let jsonText = content.trim();
    const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonText = fence[1].trim();
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1);
    }
    try {
      const parsed = JSON.parse(jsonText);
      const parseLinks = (arr: unknown) =>
        Array.isArray(arr)
          ? arr
              .slice(0, 5)
              .map((it: any) => ({ titulo: String(it?.titulo ?? ""), url: String(it?.url ?? "") }))
              .filter((it) => it.titulo && it.url)
          : [];
      return {
        profundidade: String(parsed.profundidade ?? ""),
        exemplo: String(parsed.exemplo ?? ""),
        analogia: String(parsed.analogia ?? ""),
        relacionados: Array.isArray(parsed.relacionados)
          ? parsed.relacionados.slice(0, 8).map((s: unknown) => String(s))
          : [],
        docLink: parsed.docLink && parsed.docLink !== "null" ? String(parsed.docLink) : null,
        videos: parseLinks(parsed.videos),
        artigos: parseLinks(parsed.artigos),
        exemplosLinks: parseLinks(parsed.exemplosLinks),
      };
    } catch {
      return {
        profundidade: content,
        exemplo: "",
        analogia: "",
        relacionados: [] as string[],
        docLink: null as string | null,
        videos: [] as { titulo: string; url: string }[],
        artigos: [] as { titulo: string; url: string }[],
        exemplosLinks: [] as { titulo: string; url: string }[],
      };
    }
  }));

/* ---------- Feedback: satisfaction score + "Erramos em algo?" ---------- */
const NotaSchema = z.object({
  score: z.number().int().min(0).max(100),
  comentario: z.string().trim().max(2000).optional(),
  termo: z.string().max(200).default(""),
  modo: zModo.optional(), tamanho: zTamanho.optional(), analise: zAnalise.optional(),
  requestId: z.string().max(80).optional(),
  sessionId: z.string().max(64).optional(),
});

export const enviarNota = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => NotaSchema.parse(d))
  .handler(async ({ data }) => {
    const ipHash = reqIpHash();
    try { await rateLimit(ipHash, "fb", 20); } catch (e) { throw new Error((e as Error).message); }
    await put({ pk: `DAY#${today()}`, sk: `SCORE#${newId()}`, ...data, ipHash, ttl: nowSec() + 365 * DAY });
    void bump(`METRIC#${today().slice(0, 7)}`, `score#${data.score}`);
    let notified = false;
    if (data.score <= 25 || data.comentario) {
      notified = await notify(`[HELION] Nota ${data.score}%: ${data.termo || "imagem"}`,
        `Nota: ${data.score}%\nTermo: ${data.termo}\nModo: ${data.modo}/${data.tamanho}/${data.analise}\nComentário: ${data.comentario ?? "-"}\nrequestId: ${data.requestId}\nQuando: ${new Date().toISOString()}`);
    }
    return { ok: true, notified };
  });

const FeedbackSchema = z.object({
  texto: z.string().trim().min(5, "Conte um pouco mais (mín. 5 caracteres).").max(2000),
  termo: z.string().max(200).default(""),
  resposta: z.string().max(4000).default(""),
  score: z.number().int().min(0).max(100).nullish(),
  contato: z.string().trim().max(120).optional(),
  website: z.string().max(0).optional(), // honeypot: must stay empty
  requestId: z.string().max(80).optional(),
  sessionId: z.string().max(64).optional(),
});

export const reportarErro = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FeedbackSchema.parse(d))
  .handler(async ({ data }) => {
    const ipHash = reqIpHash();
    try { await rateLimit(ipHash, "fb", 3); } catch (e) { throw new Error((e as Error).message); }
    const { website: _hp, ...rest } = data;
    await put({ pk: "FEEDBACK", sk: newId(), ...rest, ipHash, status: "novo" });
    const ok = await notify(`[HELION] Contestação: ${data.termo || "imagem enviada"}`,
      `Contestação recebida no HeliOn\n\nTermo: ${data.termo}\nNota: ${data.score ?? "-"}\nContato: ${data.contato || "-"}\n\n--- O que erramos ---\n${data.texto}\n\n--- Resposta original (trecho) ---\n${data.resposta.slice(0, 2000)}\n\nrequestId: ${data.requestId ?? "-"}\nQuando: ${new Date().toISOString()}`);
    if (!ok) throw new Error("Não conseguimos enviar agora. Tente novamente em instantes.");
    return { ok: true };
  });
