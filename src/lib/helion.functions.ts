import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Mode = "casual" | "tecnica";
type Length = "curta" | "longa";

interface HumanizeInput {
  termo: string;
  modo: Mode;
  tamanho: Length;
  imageDataUrl?: string | null;
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

function systemPrompt(modo: Mode, tamanho: Length) {
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

async function callGateway(body: unknown): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos esgotados no workspace Lovable AI.");
    throw new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export const humanize = createServerFn({ method: "POST" })
  .inputValidator((d: HumanizeInput) => d)
  .handler(async ({ data }) => {
    const userContent: any[] = [];
    const userText = data.imageDataUrl
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
      model: MODEL,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt(data.modo, data.tamanho) },
        { role: "user", content: userContent },
      ],
    });

    const trimmed = content.trim();
    if (trimmed.includes('"fora_de_escopo"') && trimmed.includes("true")) {
      return { foraDeEscopo: true as const };
    }
    return { foraDeEscopo: false as const, texto: trimmed };
  });

interface DeepDiveInput {
  termo: string;
}

const DEEP_SYSTEM = `Você é um especialista em tecnologia. Para o termo informado, responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem texto extra) com este formato exato:
{
  "profundidade": "3-5 parágrafos detalhados sobre o tema",
  "exemplo": "exemplo real em 1-2 parágrafos",
  "analogia": "analogia criativa em 1-2 frases",
  "relacionados": ["conceito1","conceito2","conceito3","conceito4"],
  "docLink": "URL da documentação oficial ou null"
}
Em português brasileiro. Prosa fluida, sem listas com bullets dentro do texto. Se não houver documentação oficial clara, use null no docLink (sem aspas).`;

export const deepDive = createServerFn({ method: "POST" })
  .inputValidator((d: DeepDiveInput) => d)
  .handler(async ({ data }) => {
    const content = await callGateway({
      model: MODEL,
      max_tokens: 1800,
      messages: [
        { role: "system", content: DEEP_SYSTEM },
        { role: "user", content: `Termo: ${data.termo}` },
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
      return {
        profundidade: String(parsed.profundidade ?? ""),
        exemplo: String(parsed.exemplo ?? ""),
        analogia: String(parsed.analogia ?? ""),
        relacionados: Array.isArray(parsed.relacionados)
          ? parsed.relacionados.slice(0, 8).map((s: unknown) => String(s))
          : [],
        docLink: parsed.docLink && parsed.docLink !== "null" ? String(parsed.docLink) : null,
      };
    } catch {
      return {
        profundidade: content,
        exemplo: "",
        analogia: "",
        relacionados: [] as string[],
        docLink: null as string | null,
      };
    }
  });