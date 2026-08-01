# HELION · Glossário de Tecnologia

HELION é um glossário interativo de tecnologia com IA. O usuário digita um termo, sigla ou expressão técnica (ou envia um print/foto) e a aplicação devolve uma explicação humanizada em português — em tom casual ou técnico, curta ou longa. Há também um modo de **análise de código**, que identifica a linguagem de um trecho de código em uma imagem e explica linha a linha, e um modo **"deep dive"**, que expande o termo com exemplo prático, analogia, tópicos relacionados e links de referência.

Se o termo/imagem não for sobre tecnologia, a IA responde que está fora do escopo em vez de alucinar uma resposta.

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (SSR) + [TanStack Router](https://tanstack.com/router) |
| UI | React 19, Tailwind CSS 4, componentes Radix UI no estilo [shadcn/ui](https://ui.shadcn.com) |
| Dados/estado | TanStack Query |
| Build | Vite 7 |
| Backend-as-a-service | Supabase (`@supabase/supabase-js`) — cliente, cliente admin e middleware de auth já escafoldados em `src/integrations/supabase/`, ainda não consumidos pela UI |
| IA | Chamada a um endpoint de chat compatível com OpenAI (`google/gemini-2.5-flash`) via *server function* do TanStack Start, hoje roteada pelo **AI Gateway do Lovable** |
| Runtime alvo atual | Cloudflare Workers (via `wrangler` + `@cloudflare/vite-plugin`) |
| Gerenciador de pacotes | [Bun](https://bun.sh) |

## Estrutura do projeto

```
src/
  routes/
    __root.tsx          # shell HTML, <head>, error/404 boundaries
    index.tsx            # tela única da aplicação (formulário + resultado)
  lib/
    helion.functions.ts   # server functions: humanize() e deepDive() (chamam a IA)
    error-capture.ts       # captura erros não tratados no SSR
    error-page.ts           # página HTML de erro genérica
    utils.ts
  integrations/supabase/    # clientes Supabase (client, admin, middlewares de auth)
  components/ui/             # componentes shadcn/ui (Radix + Tailwind)
  server.ts                   # entrypoint do worker Cloudflare (fetch handler)
  start.ts                     # configuração do TanStack Start (middlewares globais)
  router.tsx                    # criação do router + query client
supabase/config.toml           # id do projeto Supabase
```

A aplicação é essencialmente uma única rota (`/`) com um formulário complexo — não há páginas adicionais nem autenticação de usuário ativa no momento.

## Variáveis de ambiente

Crie um arquivo `.env` (veja `.env.example`) com:

| Variável | Uso |
|---|---|
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon) do Supabase |
| `VITE_SUPABASE_PROJECT_ID` | Id do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (server-side apenas, bypassa RLS) — necessária apenas se `client.server.ts` for usado |
| `LOVABLE_API_KEY` | Chave usada hoje para autenticar no AI Gateway do Lovable (ver seção abaixo — precisa ser substituída fora do Lovable) |

As variáveis com prefixo `VITE_` ficam visíveis no bundle do client; as demais só existem no servidor.

## Rodando localmente

```bash
bun install
bun run dev       # http://localhost:3000 (padrão do Vite)
bun run build      # build de produção
bun run preview     # serve o build de produção localmente
bun run lint          # eslint
bun run format          # prettier --write
```

---

## O que é específico do Lovable (e precisa saber antes de sair de lá)

Este projeto foi criado no [Lovable](https://lovable.dev), então parte da configuração depende do ambiente/sandbox do Lovable e **não funciona fora dele**. Os pontos de acoplamento são:

1. **`vite.config.ts` usa `@lovable.dev/vite-tanstack-config`**
   Esse pacote embrulha e injeta automaticamente: o plugin do TanStack Start, o plugin do React, Tailwind, `vite-tsconfig-paths`, o plugin do Cloudflare (só no build), o `componentTagger` do Lovable (edição visual, só em dev), injeção de env `VITE_*` e detecção de sandbox (porta/host). Fora do Lovable isso não resolve (o pacote é privado ao workspace do Lovable) e o build quebra.

2. **Deploy alvo é Cloudflare Workers**, não um servidor Node genérico:
   - `wrangler.jsonc` define o worker.
   - `src/server.ts` exporta um `fetch(request, env, ctx)` no formato de *module worker* do Cloudflare, com uma camada extra para transformar erros 500 "engolidos" pelo h3 em uma página de erro amigável.
   - Isso é outro motivo pelo qual o app não builda como um "site Node normal" hoje.

3. **A funcionalidade de IA depende do AI Gateway do Lovable**
   Em `src/lib/helion.functions.ts`, as duas *server functions* (`humanize` e `deepDive`) chamam:
   ```ts
   const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
   const apiKey = process.env.LOVABLE_API_KEY;
   ```
   Esse gateway só responde para chaves emitidas dentro de um workspace Lovable — **sem Lovable, essa chamada simplesmente falha** com "LOVABLE_API_KEY not configured" ou erro de autenticação. É o ponto mais crítico para resolver, porque é a funcionalidade central do produto.

4. **Metadados do editor**: a pasta `.lovable/project.json` guarda apenas metadados do template usado pelo editor do Lovable — inofensiva, mas sem função fora dele.

5. **Detalhes cosméticos**: `twitter:site: "@Lovable"` em `src/routes/__root.tsx`, e as mensagens de erro do Supabase ("Connect Supabase in Lovable Cloud") em `client.ts`, `client.server.ts` e `auth-middleware.ts` — o Supabase em si **não** é do Lovable (é um serviço próprio, só foi provisionado via integração "Lovable Cloud"), mas o texto do erro assume que você vai resolver isso na UI do Lovable.

6. **`bun.lock`** tem várias dependências resolvidas contra um *registry mirror* privado do Lovable (`europe-west1-npm.pkg.dev/lovable-core-prod/...`). Isso não impede o build, mas numa máquina/CI fora do Lovable o `bun install` vai re-resolver essas mesmas versões contra o npm público — é esperado e seguro, mas o lockfile vai mudar.

O que **não** é lovable-specific e pode continuar como está: React, TanStack Start/Router/Query, Tailwind, os componentes shadcn/ui, e o Supabase (é só uma integração de banco, portável para qualquer host).

## Checklist para remover o Lovable e preparar para AWS

TanStack Start usa o **Nitro** como motor de build/servidor por baixo dos panos, e Nitro tem presets prontos para vários destinos (`node-server`, `aws-lambda`, `bun`, `vercel`, etc.), então a "saída" natural do Cloudflare para a AWS é troca de preset, não reescrita do app.

**1. Trocar o `vite.config.ts` pela configuração explícita (sem o pacote do Lovable):**

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "node-server" }), // troque para "aws-lambda" se for serverless
    viteReact(),
  ],
});
```

Isso substitui, um a um, tudo que o pacote do Lovable escondia — exceto o `componentTagger` (ferramenta de edição visual do Lovable, sem sentido fora do editor) e a detecção de sandbox (também exclusiva do ambiente deles).

**2. Escolher o destino na AWS e ajustar o preset/deploy:**

| Opção | Preset Nitro | Quando escolher |
|---|---|---|
| **ECS Fargate / App Runner** (container) | `node-server` | Recomendado: SSR "always-on" simples, sem cold start, fácil de dimensionar. Empacota num `Dockerfile` (`node .output/server/index.mjs`) |
| **AWS Lambda** (+ Function URL ou API Gateway) | `aws-lambda` | Se quiser serverless "pague pelo uso"; exige `nitro({ preset: "aws-lambda", awsLambda: { streaming: true } })` |
| **EC2 / Elastic Beanstalk** | `node-server` | Se já tem infraestrutura EC2 e prefere gerenciar o processo você mesmo (ex: com `pm2`) |

Recomendo `node-server` + ECS Fargate/App Runner: é o caminho com menos superfície de coisa pra dar errado e mais parecido com "rodar `bun run build && bun run start`" localmente.

**3. Reescrever `src/server.ts` / `src/start.ts`.**
O `fetch(request, env, ctx)` atual é o formato de *module worker* do Cloudflare — o preset `node-server` do Nitro já gera seu próprio servidor HTTP (baseado em h3), então essa camada deixa de ser necessária como está. A lógica de página de erro amigável (`renderErrorPage`) pode ser mantida dentro de um middleware do `start.ts` (o `errorMiddleware` que já existe lá cobre boa parte disso).

**4. Substituir o AI Gateway do Lovable por uma chamada direta ao provedor.**
O modelo usado é `google/gemini-2.5-flash`, então o caminho mais direto é chamar a API do Gemini diretamente (ou manter o formato "compatível com OpenAI" apontando para o endpoint compatível do Google, ou trocar por OpenAI/Anthropic se preferir). Em `src/lib/helion.functions.ts`, troque:
```ts
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const apiKey = process.env.LOVABLE_API_KEY;
```
por uma chamada ao endpoint real do provedor escolhido, com uma nova env var (ex.: `GEMINI_API_KEY`). O resto da função (`callGateway`, parsing da resposta) muda pouco se você mantiver um endpoint compatível com o formato OpenAI Chat Completions.

**5. Remover o que só existe por causa do Lovable:**
   - pasta `.lovable/`
   - dependência `@lovable.dev/vite-tanstack-config` do `package.json`
   - `bunfig.toml`: linha `minimumReleaseAgeExcludes = ["@lovable.dev/vite-tanstack-config"]`
   - `wrangler.jsonc` e o pacote `@cloudflare/vite-plugin` (se não for manter Cloudflare como alvo secundário)
   - `twitter:site: "@Lovable"` em `__root.tsx`
   - ajustar as mensagens "Connect Supabase in Lovable Cloud" para instruções genéricas (ex.: "defina as variáveis de ambiente do Supabase")

**6. Gerar `.env.example`** e mover segredos (Supabase service role, chave da IA) para o gerenciador de secrets da AWS (Secrets Manager / SSM Parameter Store) em vez de `.env` versionado.

**7. Reinstalar dependências fora do sandbox do Lovable** (`bun install`), o que vai atualizar o `bun.lock` para resolver contra o npm público em vez do mirror privado do Lovable — esperado, sem risco.

> Este README documenta o estado atual e o plano de migração. Nenhuma dessas mudanças foi aplicada ainda — é um guia para você (ou para mim, se pedir) executar o próximo passo.
