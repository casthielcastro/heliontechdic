# HELION · Glossário de Tecnologia

HELION é um glossário interativo de tecnologia com IA. O usuário digita um termo, sigla ou expressão técnica (ou envia um print/foto) e a aplicação devolve uma explicação humanizada em português — em tom casual ou técnico, curta ou longa. Há também um modo de **análise de código**, que identifica a linguagem de um trecho de código em uma imagem e explica linha a linha, e um modo **"deep dive"**, que expande o termo com exemplo prático, analogia, tópicos relacionados e links de referência.

Se o termo/imagem não for sobre tecnologia, a IA responde que está fora do escopo em vez de alucinar uma resposta.

Produção: **https://usehelion.com.br**

## Origem e migração da IA

O HeliOn começou no [Lovable](https://lovable.dev), com o modelo `google/gemini-2.5-flash` pelo AI Gateway do Lovable, rodando em Cloudflare Workers. O backend de IA já foi migrado para o **Amazon Bedrock**, modelo **Amazon Nova Lite** (`us.amazon.nova-lite-v1:0`), via Converse API (`ConverseCommand` em `src/lib/helion.functions.ts`). A aplicação roda hoje na AWS (CloudFront, S3 privado e Lambda).

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (SSR) + [TanStack Router](https://tanstack.com/router) |
| UI | React 19, Tailwind CSS 4, componentes Radix UI no estilo [shadcn/ui](https://ui.shadcn.com) |
| Dados/estado | TanStack Query |
| Build | Vite 7, preset Nitro `aws-lambda` (local: `NITRO_PRESET=node-server`) |
| IA | Amazon Bedrock, Amazon Nova Lite (`us.amazon.nova-lite-v1:0`), via `ConverseCommand` em `src/lib/helion.functions.ts` |
| Runtime em produção | AWS: CloudFront + S3 privado (OAC) + Lambda arm64 (Node 22, 512 MB) |
| Origem (substituída) | Gemini 2.5 Flash pelo AI Gateway do Lovable, em Cloudflare Workers |
| Gerenciador de pacotes | [Bun](https://bun.sh) |

Nesta branch (`main`), as server functions publicadas são só `humanize` e `deepDive`.

## Camada de dados

O que existe **nesta branch (`main`)**:

- Não há tabela DynamoDB nem tópico SNS no `infra/template.yaml`. A Lambda só recebe `BEDROCK_MODEL_ID`, `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. Não existem `TABLE_NAME`, `TOPIC_ARN` nem `ORIGIN_SECRET`.
- As server functions não gravam telemetria, notas, contestações, rate limit nem cota.
- **Supabase:** os clientes e o middleware de auth estão em `src/integrations/supabase/`, a dependência `@supabase/supabase-js` está no `package.json`, e o template ainda passa `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` para a Lambda. Nenhuma rota nem server function importa esses clientes — o Supabase **não é usado** pela aplicação.

A camada de dados **em produção** (https://usehelion.com.br) está implementada na branch [`aws-deploy`](https://github.com/casthielcastro/heliontechdic/tree/aws-deploy), em `src/lib/backend.server.ts`, e é o que o site usa hoje:

- Uma tabela única do **DynamoDB** on-demand (`TelemetryTable`), chaves `pk`/`sk`, TTL e PITR. A Lambda recebe o nome em `TABLE_NAME`. Sem essa variável (modo dev), as gravações são ignoradas.
- O que é guardado: eventos de telemetria e de IA (TTL 90 dias), notas de satisfação (TTL 365 dias), contestações em `FEEDBACK` (sem TTL), agregados mensais e contadores de rate limit / cota diária (padrão 2.000 chamadas de IA).
- Fluxo: `humanize` / `deepDive` passam pelo rate limit e, depois do Bedrock, gravam um evento; `enviarNota` grava a nota e avisa por e-mail se ela for ≤ 25% ou tiver comentário; `reportarErro` (“Erramos em algo?”) grava a contestação e envia e-mail (se o SNS falhar, a função devolve erro); o cliente envia telemetria em lote em `POST /api/t`. O IP entra só como hash SHA-256; não há PII de propósito.
- **SNS** (`TOPIC_ARN`, tópico `helion-feedback`): e-mail para `casthiel.cloud@gmail.com` nas notas acima, em toda contestação, e nos alarmes do CloudWatch (Errors e Throttles da Lambda).
- O Supabase também permanece só escafoldado nessa branch — os dados de produção passam pelo DynamoDB e pelo SNS.

## Variáveis de ambiente

Crie um arquivo `.env` com o que for usar localmente. As variáveis com prefixo `VITE_` ficam visíveis no bundle do client; as demais só existem no servidor.

| Variável | Uso |
|---|---|
| `BEDROCK_MODEL_ID` | Opcional. Padrão: `us.amazon.nova-lite-v1:0` |
| `AWS_REGION` | Região do Bedrock. Padrão: `us-east-1` |
| Credenciais AWS | Perfil ou credenciais locais com `bedrock:InvokeModel` / `bedrock:Converse`. O `bun run dev` usa isso. `LOVABLE_API_KEY` não é mais usada. |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | URL do projeto Supabase (presente no template; a UI não consome) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon) do Supabase (idem) |
| `VITE_SUPABASE_PROJECT_ID` | Id do projeto Supabase (só no client escafoldado) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (server-side), só se `client.server.ts` for usado |

Na branch `aws-deploy` / em produção também existem `TABLE_NAME`, `TOPIC_ARN`, `ORIGIN_SECRET` e `DAILY_QUOTA`.

## Estrutura do projeto

```
src/
  routes/
    __root.tsx          # shell HTML, <head>, error/404 boundaries
    index.tsx            # tela única da aplicação (formulário + resultado)
  lib/
    helion.functions.ts   # server functions: humanize() e deepDive() (chamam o Bedrock)
    error-capture.ts       # captura erros não tratados no SSR
    error-page.ts           # página HTML de erro genérica
    utils.ts
  integrations/supabase/    # clientes Supabase (não importados pela UI)
  components/ui/             # componentes shadcn/ui (Radix + Tailwind)
  server.ts                   # entrypoint da Lambda (Nitro aws-lambda)
  start.ts                     # configuração do TanStack Start
  router.tsx                    # criação do router + query client
infra/                         # template SAM e script de deploy
supabase/config.toml           # id do projeto Supabase
```

A aplicação é essencialmente uma única rota (`/`) — não há autenticação de usuário ativa no momento.

## Rodando localmente

```bash
bun install
bun run dev       # http://localhost:8080 (porta do vite.config.ts)
bun run build      # build de produção (preset aws-lambda)
bun run preview     # serve o build de produção localmente
bun run lint          # eslint
bun run format          # prettier --write
```

## Deploy

```bash
export AWS_DEFAULT_REGION=us-east-1
DOMAIN_NAME=usehelion.com.br CERTIFICATE_ARN=<arn ACM us-east-1> HOSTED_ZONE_ID=<zona Route 53> ./infra/deploy.sh
```

O script faz `bun install && bun run build` e `sam deploy`, depois envia os assets de `.output/public` ao S3.

## O que ainda restou do Lovable

A troca do `vite.config.ts`, o preset Nitro `aws-lambda`, o `src/server.ts` e a chamada ao Bedrock já estão feitos nesta branch. Ainda aparecem vestígios que não afetam o funcionamento:

- pasta `.lovable/` (metadados do editor)
- `bunfig.toml` com exclusão de `@lovable.dev/vite-tanstack-config` (o pacote já não está no `package.json`)
- `twitter:site: "@Lovable"` em `src/routes/__root.tsx`
- mensagens “Connect Supabase in Lovable Cloud” nos clientes Supabase, que a UI não chama

## Checklist (o que já foi feito e o que ficou na `aws-deploy`)

1. **Trocar o `vite.config.ts`** pela configuração explícita, sem o pacote do Lovable — **feito**.
2. **Destino AWS Lambda** com preset Nitro `aws-lambda` — **feito**.
3. **Reescrever `src/server.ts` / `src/start.ts`** para o runtime da Lambda — **feito** nesta branch (versão mais recente, com checagem de origem e `/api/t`, está na `aws-deploy`).
4. **Substituir o AI Gateway do Lovable pelo Amazon Bedrock (Amazon Nova Lite)** — **feito**. O modelo em produção é `us.amazon.nova-lite-v1:0`, via Converse API (`ConverseCommand` em `src/lib/helion.functions.ts`). Não se chama mais o Gemini nem o gateway do Lovable:

```ts
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
const MODEL = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-lite-v1:0";
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
```

5. **Limpar vestígios do Lovable** (`.lovable/`, `twitter:site`, textos do Supabase) — ainda pendente.
6. **Camada de dados (DynamoDB, SNS, telemetria, rate limit, feedback)** — implementada na branch `aws-deploy` e já em produção; ainda não está mesclada nesta `main`.

A migração da IA para o Bedrock e o deploy na AWS já estão no ar em https://usehelion.com.br.
