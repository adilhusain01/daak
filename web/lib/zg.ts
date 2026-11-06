import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { env } from "./env";

export type Check = {
  match: boolean;
  codeRead: string;
  condition: "intact" | "damaged" | "opened" | "unclear";
  reason: string;
  requestId?: string;
  verified: boolean | null;
  model: string;
};

let brokerPromise: ReturnType<typeof createZGComputeNetworkBroker> | null = null;
function broker() {
  brokerPromise ??= createZGComputeNetworkBroker(new ethers.Wallet(env.zgKey(), new ethers.JsonRpcProvider(env.zgRpc())));
  return brokerPromise;
}

/**
 * Asks a sealed (TeeML) vision model on 0G whether this parcel belongs on this hop and is still intact.
 * Throws when 0G cannot be reached or has no credit; the caller must then record the handoff as unchecked.
 */
/** The one question every vision check answers, sealed on 0G or the labelled backup. */
export const parcelPrompt = (expectedCode: string, hopLabel: string) =>
  `You check parcels handed between bus drivers in India. The parcel should carry the consignment code "${expectedCode}" ` +
  `written on it, and this handoff is ${hopLabel}. Look at the photo and answer only with JSON: ` +
  `{"code_read": string (the code you can read, or ""), "match": boolean (true only if the code you read is ${expectedCode}), ` +
  `"condition": "intact" | "damaged" | "opened" | "unclear", "reason": string (one short sentence)}.`;

/** Parses a model's JSON answer into a check (shared by 0G and the backup). */
export function parseAnswer(content: string) {
  const json = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
  return {
    match: Boolean(json.match),
    codeRead: String(json.code_read ?? ""),
    condition: (["intact", "damaged", "opened"].includes(json.condition) ? json.condition : "unclear") as Check["condition"],
    reason: String(json.reason ?? ""),
  };
}

/** The driver never waits on 0G for more than this; past it, the handoff takes the safe-stop path. */
export const ZG_BUDGET_MS = Number(process.env.ZG_BUDGET_MS ?? 20000);

/** After 0G fails, handoffs skip it for a while (the driver should not wait 20 s each time); rechecks always try. */
let zgDownUntil = 0;
export const ZG_RETRY_MS = Number(process.env.ZG_RETRY_MS ?? 10 * 60 * 1000);

export async function checkParcel(photo: Buffer, expectedCode: string, hopLabel: string, budgetMs = ZG_BUDGET_MS, alwaysTry = false): Promise<Check> {
  if (!alwaysTry && Date.now() < zgDownUntil) throw new Error("0G was unavailable a few minutes ago; skipped for now, recheck later");
  try {
    const r = await Promise.race([
      checkParcelInner(photo, expectedCode, hopLabel),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`0G did not answer within ${budgetMs / 1000} s`)), budgetMs)),
    ]);
    zgDownUntil = 0;
    return r;
  } catch (e) {
    zgDownUntil = Date.now() + ZG_RETRY_MS;
    throw e;
  }
}

/** The Router is 0G's API-key gateway (pc.0g.ai); with a key set, checks go through it to a sealed provider. */
export const ROUTER = process.env.ZG_ROUTER_URL ?? "https://router-api.0g.ai/v1";
const routerModel = () => process.env.ZG_ROUTER_MODEL ?? "0gm-1.0-35b-a3b";

/** A healthy, TEE-acknowledged provider for the vision model, pinned so the Router never falls back to an unsealed one. */
let routed: { address: string; at: number } | null = null;
async function sealedRouterProvider() {
  if (routed && Date.now() - routed.at < 10 * 60 * 1000) return routed.address;
  const r = await fetch(`${ROUTER}/providers?model=${encodeURIComponent(routerModel())}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`0G Router ${r.status} listing providers`);
  const list = ((await r.json()).data ?? []) as { address: string; is_healthy?: boolean; tee_acknowledged?: boolean; architecture?: { input_modalities?: string[] } }[];
  const p = list.find((x) => x.is_healthy && x.tee_acknowledged && x.architecture?.input_modalities?.includes("image"));
  if (!p) throw new Error("No sealed (TEE) vision provider is live on the 0G Router right now");
  routed = { address: p.address, at: Date.now() };
  return p.address;
}

/** The sealed provider Daak pays from its own compute account (0G Direct), and its model. */
const DIRECT_PROVIDER = process.env.ZG_DIRECT_PROVIDER ?? "0xf4FB8d2bD856e672b5f9848b0eD235A20079B250";
const DIRECT_MODEL = process.env.ZG_DIRECT_MODEL ?? "0GM-1.0-35B-A3B";
export const DIRECT_BUDGET_MS = Number(process.env.ZG_DIRECT_BUDGET_MS ?? 12000);

/**
 * The same sealed question, paid by Daak's own 0G compute account (Direct) instead of the Router credit: the agent
 * pays for its own checks, and the provider's TEE signature on the answer is verified.
 */
async function askDirect(photo: Buffer, prompt: string, budgetMs: number) {
  const b = await broker();
  const { endpoint, model } = await b.inference.getServiceMetadata(DIRECT_PROVIDER, DIRECT_MODEL);
  const headers = await b.inference.getRequestHeaders(DIRECT_PROVIDER);
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    signal: AbortSignal.timeout(budgetMs),
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 400, chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photo.toString("base64")}` } },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`0G Direct ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const requestId: string | undefined = res.headers.get("ZG-Res-Key") ?? data.id;
  const verified = await b.inference.processResponse(DIRECT_PROVIDER, requestId, JSON.stringify(data.usage ?? {})).catch(() => null);
  return { content: String(data.choices?.[0]?.message?.content ?? ""), requestId, verified: verified ?? null, model: `${model}, paid by Daak's own 0G compute account, provider ${DIRECT_PROVIDER}` };
}

/**
 * Any question about a photo, answered by the sealed vision model: first from Daak's own compute account (Direct),
 * then through the Router credit if that fails. Returns the text, the receipt and whether the TEE signature checked.
 */
export async function askSealed(photo: Buffer, prompt: string, budgetMs = 40_000): Promise<{ content: string; requestId?: string; model: string; verified?: boolean | null }> {
  if (process.env.ZG_PRIVATE_KEY && process.env.ZG_DIRECT !== "0") {
    try { return await askDirect(photo, prompt, Math.min(budgetMs, DIRECT_BUDGET_MS)); }
    catch (e) { console.error("0G direct", (e as Error).message.slice(0, 160)); }
  }
  return askRouter(photo, prompt, budgetMs);
}

async function askRouter(photo: Buffer, prompt: string, budgetMs: number): Promise<{ content: string; requestId?: string; model: string; verified?: boolean | null }> {
  if (!process.env.ZG_ROUTER_KEY) throw new Error("0G Router key is not set");
  const provider = await sealedRouterProvider();
  const res = await fetch(`${ROUTER}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ZG_ROUTER_KEY}`, "X-0G-Provider-Address": provider, "X-0G-Provider-Trust-Mode": "private" },
    signal: AbortSignal.timeout(budgetMs),
    body: JSON.stringify({
      model: routerModel(),
      temperature: 0,
      max_tokens: 400,
      chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photo.toString("base64")}` } },
      ] }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`0G Router ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  return { content: data.choices?.[0]?.message?.content ?? "", requestId: data.id ?? res.headers.get("x-request-id") ?? undefined, model: `${data.model ?? routerModel()} via 0G Router, provider ${provider}` };
}

async function checkParcelInner(photo: Buffer, expectedCode: string, hopLabel: string): Promise<Check> {
  const r = await askSealed(photo, parcelPrompt(expectedCode, hopLabel));
  return { ...parseAnswer(r.content), requestId: r.requestId, verified: r.verified ?? null, model: r.model };
}
