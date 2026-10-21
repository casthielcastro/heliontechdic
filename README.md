# HELION · Glossário de Tecnologia

HELION é um glossário interativo de tecnologia com IA. O usuário digita um termo, sigla ou expressão técnica (ou envia um print/foto) e a aplicação devolve uma explicação humanizada em português — em tom casual ou técnico, curta ou longa. Há também um modo de **análise de código**, que identifica a linguagem de um trecho de código em uma imagem e explica linha a linha, e um modo **"deep dive"**, que expande o termo com exemplo prático, analogia, tópicos relacionados e links de referência.

Se o termo/imagem não for sobre tecnologia, a IA responde que está fora do escopo em vez de alucinar uma resposta.

Produção: **https://usehelion.com.br** (AWS, conta pessoal, foco em custo mínimo).

## Arquitetura (AWS)

```
Usuário ──HTTPS──> CloudFront (compressão br/gzip, SecurityHeadersPolicy, HTML em cache s-maxage=300)
   ├─ /assets/*, /robots.txt, /favicon.ico, /og.png ──OAC──> S3 privado (immutable, 1 ano)
   └─ /, /_serverFn/*, /api/t ──header secreto X-Origin-Verify──> Lambda (Function URL, Node 22 arm64, 512 MB, 25 s)
        ├─ Bedrock Nova Lite (Converse; texto + imagem; timeout 20 s, 2 tentativas)
        ├─ DynamoDB on-demand (tabela única: telemetria, notas, contestações, rate limit/cota; TTL; PITR)
        └─ SNS helion-feedback ──e-mail──> casthiel.cloud@gmail.com
CloudWatch: logs 14 dias + alarmes Errors/Throttles -> SNS · Budgets: monthly-5usd e zero-spend-template
```

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start (SSR) + TanStack Router, React 19, Vite 7, Bun |
| IA | Amazon Bedrock `us.amazon.nova-lite-v1:0` via `ConverseCommand` (`src/lib/helion.functions.ts`) |
| Back-end | Server functions `humanize`, `deepDive`, `enviarNota`, `reportarErro` + `POST /api/t` (telemetria em lote via `sendBeacon`, em `src/server.ts`) |
| Dados | DynamoDB single-table (`src/lib/backend.server.ts`) |
| Infra | SAM: `infra/template.yaml`, deploy: `infra/deploy.sh` |

### Segurança e anti-abuso
- Function URL só aceita requisições com o header `X-Origin-Verify` injetado pelo CloudFront (acesso direto = 403). O segredo é gerado no 1º deploy e reaproveitado (lido da config da função).
- Validação com **zod** (termo ≤ 200 chars, enums, imagem ≤ ~1,5 MB e só PNG/JPEG/WEBP/GIF, contexto ≤ 1.200); imagem é reduzida no navegador (≤ 1568 px, JPEG).
- Rate limit por IP (hash SHA-256 com salt): 10 chamadas de IA/min, feedback 3/min, notas 20/min; **cota diária global** de 2.000 chamadas de IA (`DailyQuota`).
- Erros do Bedrock viram mensagens amigáveis em pt-BR; detalhe só nos logs/telemetria.
- Concorrência reservada: **não aplicada** — a conta tem cota de 10 execuções simultâneas e a AWS exige 10 não reservadas. Pedir aumento (gratuito) e reservar 3–5 se quiser um teto rígido.

### DynamoDB (tabela única `pk`/`sk`, TTL no atributo `ttl`)
| Item | pk | sk | TTL |
|---|---|---|---|
| Evento (clique, erro, pageview, latência IA) | `DAY#AAAA-MM-DD` | `EVT#<tipo>#<ISO>#<id>` | 90 dias |
| Nota de satisfação | `DAY#<dia>` | `SCORE#<ISO>#<id>` | 365 dias |
| Contestação ("Erramos em algo?") | `FEEDBACK` | `<ISO>#<id>` | sem TTL |
| Agregado mensal | `METRIC#AAAA-MM` | `humanize#casual#curta#padrao`, `score#25`… | sem TTL |
| Rate limit / cota | `RL#<tipo>#<ipHash>` / `QUOTA#<dia>` | `<minuto>` / `-` | 2 min / 2 dias |

SNS envia e-mail para toda contestação e para notas ≤ 25% ou com comentário.

## Deploy

```bash
export AWS_DEFAULT_REGION=us-east-1
DOMAIN_NAME=usehelion.com.br CERTIFICATE_ARN=<arn ACM us-east-1> HOSTED_ZONE_ID=<zona Route 53> ./infra/deploy.sh
```
O script: build → envia assets novos ao S3 **antes** de trocar o HTML (sem `--delete`) → `sam deploy` (tag `Project=helion`) → marca assets antigos com `stale=true` (lifecycle apaga em 30 dias) → invalida `/`.
Após o 1º deploy, **confirme a assinatura SNS** no e-mail recebido.

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


Sem `TABLE_NAME`/`TOPIC_ARN`/`ORIGIN_SECRET` no ambiente, telemetria, rate limit, SNS e a checagem de origem são desativados (modo dev). Bedrock usa suas credenciais AWS locais.

## Custos (uso de portfólio)
Lambda, CloudFront, SNS, CloudWatch (≤ 10 alarmes) e DynamoDB (25 GB) ficam no free tier. Custos reais: Bedrock Nova Lite (~US$0,30 por 1.000 consultas) e Route 53 (US$0,50/mês pela zona). Total esperado ≈ US$0,80–0,90/mês.

## Próxima fase (não implementado de propósito, para manter custo ~zero)
- **AWS WAF** no CloudFront: regras gerenciadas (Core rule set, IP reputation) + rate-based rule. Custa ~US$5/mês por Web ACL + US$1 por regra + US$0,60/milhão de requisições. Hoje o anti-abuso é feito no Lambda (rate limit + cota no DynamoDB).
- **Multi-região**: Lambda + DynamoDB Global Tables em uma 2ª região (ex.: us-west-2) com origin group/failover no CloudFront; Bedrock já usa inference profile entre regiões dos EUA. Duplica custos fixos e a complexidade de deploy.
- **Provisioned concurrency**: elimina o cold start (~1,5 s), mas é cobrada 24/7 (~US$1,5–3/mês por instância de 512 MB). Com o HTML cacheado no CloudFront, o cold start afeta só a 1ª chamada de IA.
- CI/CD com GitHub Actions + OIDC (sem chaves), streaming da resposta (ConverseStream + Function URL `RESPONSE_STREAM`), quebra de `index.tsx` em componentes e remoção de dependências não usadas (shadcn/Supabase).
