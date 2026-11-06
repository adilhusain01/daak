import { createHash } from "node:crypto";
import bs58 from "bs58";

/**
 * HCS-14 Universal Agent IDs (Hashgraph Online, draft 1.0). An AID-form UAID is the Base58 SHA-384 of six
 * canonical fields, so anyone holding the fields can recompute it and check who an agent is. Endpoints are not
 * part of it, so the id survives a URL change.
 */
export type AgentData = { registry: string; name: string; version: string; protocol: string; nativeId: string; skills: number[] };

export function canonical(a: AgentData) {
  // Key order as Hashgraph Online's reference SDK serialises it (checked against @hashgraphonline/standards-sdk 0.1.192).
  const c = {
    skills: [...a.skills].sort((x, y) => x - y),
    name: a.name.trim(),
    nativeId: a.nativeId.trim(),
    protocol: a.protocol.trim().toLowerCase(),
    registry: a.registry.trim().toLowerCase(),
    version: a.version.trim(),
  };
  if (!c.name || !c.nativeId || !c.protocol || !c.registry || !c.version) throw new Error("HCS-14 needs registry, name, version, protocol and nativeId");
  if (c.skills.some((s) => s >= 40 && s <= 99)) throw new Error("HCS-14 skill ids 40 to 99 are reserved");
  return c;
}

export function uaid(a: AgentData, uid = "0") {
  const c = canonical(a);
  const id = bs58.encode(createHash("sha384").update(JSON.stringify(c)).digest());
  return `uaid:aid:${id};uid=${uid};registry=${c.registry};proto=${c.protocol};nativeId=${c.nativeId}`;
}

/** Recompute a UAID from its fields and compare: the check one agent runs before trusting another. */
export const verifyUaid = (claimed: string, a: AgentData, uid = "0") => claimed === uaid(a, uid);

/** Daak's booking service, the agent shops pay. */
export const daakAgent = (operatorId: string): AgentData =>
  ({ registry: "daak", name: "Daak booking", version: "1", protocol: "x402", nativeId: `hedera:testnet:${operatorId}`, skills: [] });

/** A shop's ordering agent, identified by its Hedera account (the shop appears only as its badge hash). */
export const shopAgentData = (shopHash: string, accountId: string): AgentData =>
  ({ registry: "daak", name: `Daak shop agent ${shopHash}`, version: "1", protocol: "x402", nativeId: `hedera:testnet:${accountId}`, skills: [] });
