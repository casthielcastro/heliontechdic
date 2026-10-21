// Server-only helpers: DynamoDB telemetry/rate limit + SNS notifications. All best-effort.
import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, BatchWriteItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const TABLE = process.env.TABLE_NAME;
const TOPIC = process.env.TOPIC_ARN;
const SALT = process.env.ORIGIN_SECRET || "dev";
const DAILY_QUOTA = Number(process.env.DAILY_QUOTA || 2000);
const region = process.env.AWS_REGION || "us-east-1";
const ddb = new DynamoDBClient({ region, maxAttempts: 2 });
const sns = new SNSClient({ region, maxAttempts: 2 });

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const day = () => new Date().toISOString().slice(0, 10);
const id = () => `${new Date().toISOString()}#${randomUUID().slice(0, 8)}`;

export class FriendlyError extends Error {}

export function hashIp(ip: string | undefined | null) {
  return createHash("sha256").update(`${SALT}:${ip ?? "?"}`).digest("hex").slice(0, 16);
}
export function clientIp(h: (n: string) => string | null | undefined) {
  return (h("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

type Val = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];
function av(v: Val): AttributeValue | undefined {
  if (v === undefined) return undefined;
  if (v === null) return { NULL: true };
  if (typeof v === "string") return { S: v.slice(0, 4000) };
  if (typeof v === "number") return { N: String(Number.isFinite(v) ? v : 0) };
  if (typeof v === "boolean") return { BOOL: v };
  return { S: JSON.stringify(v).slice(0, 2000) };
}
function item(o: Record<string, Val>) {
  const r: Record<string, AttributeValue> = {};
  for (const [k, v] of Object.entries(o)) { const a = av(v); if (a) r[k] = a; }
  return r;
}

async function safe<T>(p: () => Promise<T>): Promise<T | undefined> {
  if (!TABLE) return undefined;
  try { return await p(); } catch (e) { console.warn("[ddb]", (e as Error)?.name, (e as Error)?.message); return undefined; }
}

export function put(o: Record<string, Val>) {
  return safe(() => ddb.send(new PutItemCommand({ TableName: TABLE, Item: item(o) })));
}
export function bump(pk: string, sk: string) {
  return safe(() => ddb.send(new UpdateItemCommand({
    TableName: TABLE, Key: item({ pk, sk }), UpdateExpression: "ADD n :1", ExpressionAttributeValues: { ":1": { N: "1" } },
  })));
}

/** Per-IP limit per minute + global daily quota. Throws FriendlyError when exceeded. */
export async function rateLimit(ipHash: string, kind: "ai" | "fb", perMin: number) {
  if (!TABLE) return;
  const minute = Math.floor(Date.now() / 60000);
  const incr = (pk: string, sk: string, max: number, ttl: number) =>
    ddb.send(new UpdateItemCommand({
      TableName: TABLE, Key: item({ pk, sk }),
      UpdateExpression: "ADD n :1 SET #t = if_not_exists(#t, :ttl)",
      ConditionExpression: "attribute_not_exists(n) OR n < :max",
      ExpressionAttributeNames: { "#t": "ttl" },
      ExpressionAttributeValues: { ":1": { N: "1" }, ":max": { N: String(max) }, ":ttl": { N: String(ttl) } },
    }));
  try {
    await incr(`RL#${kind}#${ipHash}`, String(minute), perMin, now() + 120);
    if (kind === "ai") await incr(`QUOTA#${day()}`, "-", DAILY_QUOTA, now() + 2 * DAY);
  } catch (e) {
    if ((e as Error)?.name === "ConditionalCheckFailedException") {
      throw new FriendlyError(kind === "ai"
        ? "Muitas consultas em pouco tempo. Respire um pouco e tente de novo em 1 minuto. 🌤️"
        : "Recebemos vários envios seguidos. Tente de novo em 1 minuto.");
    }
    console.warn("[ratelimit]", (e as Error)?.message); // fail open on infra error
  }
}

export function event(tipo: string, props: Record<string, Val>, days = 90) {
  return put({ pk: `DAY#${day()}`, sk: `EVT#${tipo}#${id()}`, tipo, ...props, ttl: now() + days * DAY });
}

export async function eventsBatch(evts: Record<string, Val>[], ipHash: string, ua: string) {
  if (!TABLE || !evts.length) return;
  const reqs = evts.slice(0, 20).map((e) => ({
    PutRequest: { Item: item({ pk: `DAY#${day()}`, sk: `EVT#${String(e.tipo ?? "evt").slice(0, 30)}#${id()}`, ...e, ipHash, ua: ua.slice(0, 120), ttl: now() + 90 * DAY }) },
  }));
  await safe(() => ddb.send(new BatchWriteItemCommand({ RequestItems: { [TABLE!]: reqs } })));
}

export async function notify(subject: string, body: string) {
  if (!TOPIC) return false;
  try {
    await sns.send(new PublishCommand({ TopicArn: TOPIC, Subject: subject.replace(/[\r\n]+/g, " ").slice(0, 99), Message: body.slice(0, 60000) }));
    return true;
  } catch (e) { console.error("[sns]", (e as Error)?.message); return false; }
}

export { id as newId, day as today, now as nowSec, DAY };
