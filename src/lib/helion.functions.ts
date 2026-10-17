import { createServerFn } from "@tanstack/react-start";
import { BedrockRuntimeClient, ConverseCommand, type ContentBlock, type ImageFormat } from "@aws-sdk/client-bedrock-runtime";

const MODEL = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-lite-v1:0";
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

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
  try {
    const res = await bedrock.send(new ConverseCommand({
      modelId: MODEL, system, messages,
      inferenceConfig: { maxTokens: body.max_tokens ?? 1200 },
    }));
    return res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
  } catch (e: any) {
    if (e?.name === "ThrottlingException") throw new Error("Limite de requisições. Tente novamente em instantes.");
    throw new Error(`Bedrock: ${String(e?.message ?? e).slice(0, 200)}`);
  }
}

export const humanize = createServerFn({ method: "POST" })
  .inputValidator((d: HumanizeInput) => d)
  .handler(async ({ data }) => {
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
      return { foraDeEscopo: true as const };
    }
    return { foraDeEscopo: false as const, texto: trimmed };
  });

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
  .inputValidator((d: DeepDiveInput) => d)
  .handler(async ({ data }) => {
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
  });