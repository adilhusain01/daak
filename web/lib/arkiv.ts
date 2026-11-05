import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env";

/** One handoff as the tracking page reads it. Expires a day after the handoff. */
export const Handoffs = defineSchema("daak.handoff", {
  code: str().indexed(),
  hop: i32().indexed(),
  verdict: str().indexed(),
  place: str(),
  fromBadge: str(),
  toBadge: str(),
  at: u64().indexed(),
  zgRequestId: str(),
  hcs: str(),
  photoSha256: str(),
});

function chainCfg() {
  return rabdi({ accessKey: env.arkivAccessKey() });
}

export function arkivRead() {
  return createPublicClient({ chain: chainCfg(), transport: http() });
}

export function arkivWrite() {
  return createWalletClient({ chain: chainCfg(), transport: http(), account: privateKeyToAccount(env.arkivKey()) });
}

export async function writeHandoff(h: {
  code: string; hop: number; verdict: string; place: string; fromBadge: string; toBadge: string;
  at: number; zgRequestId: string; hcs: string; photoSha256: string;
}) {
  const { entityKey, txHash } = await arkivWrite().createEntity(
    Handoffs,
    { ...h, hop: i32(h.hop), at: u64(BigInt(h.at)) },
    { expiration: ExpirationTime.fromDays(1) },
  );
  return { entityKey: String(entityKey), txHash: String(txHash) };
}

export async function readHandoffs(code: string) {
  const { eq } = await import("@arkiv-network/sdk/query");
  return arkivRead()
    .select({ $key: true, hop: true, verdict: true, place: true, at: true, zgRequestId: true, hcs: true })
    .from(Handoffs)
    .where(eq("code", code))
    .ownedBy(privateKeyToAccount(env.arkivKey()).address)
    .limit(50)
    .fetch();
}
