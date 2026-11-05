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
/** The driver never waits on 0G for more than this; past it, the handoff takes the safe-stop path. */
export const ZG_BUDGET_MS = Number(process.env.ZG_BUDGET_MS ?? 12000);

export async function checkParcel(photo: Buffer, expectedCode: string, hopLabel: string, budgetMs = ZG_BUDGET_MS): Promise<Check> {
  return await Promise.race([
    checkParcelInner(photo, expectedCode, hopLabel),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`0G did not answer within ${budgetMs / 1000} s`)), budgetMs)),
  ]);
}

/**
 * Providers on 0G come and go. Use the configured one if it still exists; otherwise find any live
 * sealed (TeeML) provider whose catalogue has a model that takes images.
 */
let picked: { provider: string; model: string; at: number } | null = null;
async function pickVisionProvider(b: Awaited<ReturnType<typeof createZGComputeNetworkBroker>>) {
  if (picked && Date.now() - picked.at < 10 * 60 * 1000) return picked;
  const services = await b.inference.listService();
  const tee = services.filter((s: { verifiability?: string }) => s.verifiability === "TeeML");
  const preferred = tee.find((s: { provider: string }) => s.provider.toLowerCase() === env.zgProvider().toLowerCase());
  for (const s of [preferred, ...tee].filter(Boolean) as { provider: string; model: string }[]) {
    try {
      const cat = await b.inference.getProviderModels(s.provider);
      const models = (cat.models ?? []) as { id: string; architecture?: { input_modalities?: string[] } }[];
      const vision = models.find((m) => m.id === env.zgModel() && m.architecture?.input_modalities?.includes("image"))
        ?? models.find((m) => m.architecture?.input_modalities?.includes("image"));
      if (vision) {
        picked = { provider: s.provider, model: vision.id, at: Date.now() };
        return picked;
      }
    } catch { /* provider not answering; try the next */ }
  }
  throw new Error("No sealed (TeeML) vision provider is live on 0G right now");
}

async function checkParcelInner(photo: Buffer, expectedCode: string, hopLabel: string): Promise<Check> {
  const b = await broker();
  const { provider, model: wanted } = await pickVisionProvider(b);
  const { endpoint, model } = await b.inference.getServiceMetadata(provider, wanted);
  const headers = await b.inference.getRequestHeaders(provider);
  const prompt =
    `You check parcels handed between bus drivers in India. The parcel should carry the consignment code "${expectedCode}" ` +
    `written on it, and this handoff is ${hopLabel}. Look at the photo and answer only with JSON: ` +
    `{"code_read": string (the code you can read, or ""), "match": boolean (true only if the code you read is ${expectedCode}), ` +
    `"condition": "intact" | "damaged" | "opened" | "unclear", "reason": string (one short sentence)}.`;
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    signal: AbortSignal.timeout(40_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photo.toString("base64")}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`0G ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const requestId: string | undefined = res.headers.get("ZG-Res-Key") ?? data.id;
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const verified = await b.inference.processResponse(provider, requestId, JSON.stringify(data.usage ?? {})).catch(() => null);
  const json = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
  return {
    match: Boolean(json.match),
    codeRead: String(json.code_read ?? ""),
    condition: ["intact", "damaged", "opened"].includes(json.condition) ? json.condition : "unclear",
    reason: String(json.reason ?? ""),
    requestId,
    verified,
    model,
  };
}
