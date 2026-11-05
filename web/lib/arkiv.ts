import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, desc, eq } from "@arkiv-network/sdk/query";
import { bytes, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "./env";

/**
 * Arkiv is Daak's database. Badges and consignments live for 30 days, handoffs for one day after
 * they happen, because nobody needs a permanent map of who carried whose parcel.
 */
export const Badges = defineSchema("daak.badge", {
  uid: str().indexed(),
  name: str(),
  role: str().indexed(),
  vehicle: str(),
});

export const Consignments = defineSchema("daak.consignment", {
  code: str().indexed(),
  parcel: str().indexed(),
  label: str(),
  route: bytes(), // JSON array of legs: { hop, from, to, place, km }; str columns stop at 128 bytes
  feeRupees: i32(),
  createdAt: u64().indexed(),
});

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
  reason: bytes(),
  geo: str().optional(), // "lat,lng,accuracyM" where the handoff happened
});

export type Leg = { hop: number; from: string; to: string; place: string; km?: number; lat?: number; lng?: number };

const chainCfg = () => rabdi({ accessKey: env.arkivAccessKey() });
export const arkivRead = () => createPublicClient({ chain: chainCfg(), transport: http() });
export const arkivWrite = () =>
  createWalletClient({ chain: chainCfg(), transport: http(), account: privateKeyToAccount(env.arkivKey()) });
export const owner = () => privateKeyToAccount(env.arkivKey()).address;

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (v: Uint8Array | `0x${string}`) =>
  typeof v === "string" ? Buffer.from(v.slice(2), "hex").toString("utf8") : new TextDecoder().decode(v);

const keyOf = (r: { entityKey: unknown; txHash: unknown }) => ({ entityKey: String(r.entityKey), txHash: String(r.txHash) });

export async function putBadge(b: { uid: string; name: string; role: string; vehicle?: string }) {
  return keyOf(await arkivWrite().createEntity(Badges, { ...b, vehicle: b.vehicle ?? "" }, { expiration: ExpirationTime.fromDays(30) }));
}

export async function getBadge(uid: string) {
  const r = await arkivRead().select({ uid: true, name: true, role: true, vehicle: true }).from(Badges)
    .where(eq("uid", uid)).ownedBy(owner()).limit(1).fetch();
  const b = r.entities[0];
  return b ? { uid: b.uid.value, name: b.name.value, role: b.role.value, vehicle: b.vehicle.value } : null;
}

export async function putConsignment(c: { code: string; parcel: string; label: string; route: Leg[]; feeRupees: number }) {
  return keyOf(await arkivWrite().createEntity(
    Consignments,
    { ...c, route: enc(JSON.stringify(c.route)), feeRupees: i32(c.feeRupees), createdAt: u64(BigInt(Date.now())) },
    { expiration: ExpirationTime.fromDays(30) },
  ));
}

type ConsignmentRow = { code: string; parcel: string; label: string; route: Leg[]; feeRupees: number; createdAt: number };

function toConsignment(e: { code: { value: string }; parcel: { value: string }; label: { value: string }; route: { value: Uint8Array | `0x${string}` }; feeRupees: { value: number }; createdAt: { value: bigint } }): ConsignmentRow {
  return { code: e.code.value, parcel: e.parcel.value, label: e.label.value, route: JSON.parse(dec(e.route.value)), feeRupees: Number(e.feeRupees.value), createdAt: Number(e.createdAt.value) };
}

/** The newest consignment for a parcel tag (a tag can be reused for a later parcel). */
export async function consignmentByParcel(parcel: string) {
  const r = await arkivRead().select({ code: true, parcel: true, label: true, route: true, feeRupees: true, createdAt: true })
    .from(Consignments).where(eq("parcel", parcel)).ownedBy(owner()).orderBy(desc("createdAt")).limit(1).fetch();
  return r.entities[0] ? toConsignment(r.entities[0]) : null;
}

export async function consignmentByCode(code: string) {
  const r = await arkivRead().select({ code: true, parcel: true, label: true, route: true, feeRupees: true, createdAt: true })
    .from(Consignments).where(eq("code", code)).ownedBy(owner()).orderBy(desc("createdAt")).limit(1).fetch();
  return r.entities[0] ? toConsignment(r.entities[0]) : null;
}

export async function recentConsignments() {
  const r = await arkivRead().select({ code: true, parcel: true, label: true, route: true, feeRupees: true, createdAt: true })
    .from(Consignments).ownedBy(owner()).orderBy(desc("createdAt")).limit(20).fetch();
  return r.entities.map(toConsignment);
}

export type HandoffRow = {
  key: string; code: string; hop: number; verdict: string; place: string; fromBadge: string; toBadge: string;
  at: number; zgRequestId: string; hcs: string; photoSha256: string; reason: string; geo?: string;
};

export async function writeHandoff(h: Omit<HandoffRow, "key">) {
  return keyOf(await arkivWrite().createEntity(
    Handoffs,
    { ...h, reason: enc(h.reason), hop: i32(h.hop), at: u64(BigInt(h.at)), geo: h.geo ?? "" },
    { expiration: ExpirationTime.fromDays(1) },
  ));
}

export async function handoffsFor(code: string): Promise<HandoffRow[]> {
  const r = await arkivRead()
    .select({ $key: true, code: true, hop: true, verdict: true, place: true, fromBadge: true, toBadge: true, at: true, zgRequestId: true, hcs: true, photoSha256: true, reason: true, geo: true })
    .from(Handoffs).where(and(eq("code", code))).ownedBy(owner()).orderBy(desc("at")).limit(50).fetch();
  return r.entities.map((e) => ({
    key: String(e.$key), code: e.code.value, hop: Number(e.hop.value), verdict: e.verdict.value, place: e.place.value,
    fromBadge: e.fromBadge.value, toBadge: e.toBadge.value, at: Number(e.at.value), zgRequestId: e.zgRequestId.value,
    hcs: e.hcs.value, photoSha256: e.photoSha256.value, reason: dec(e.reason.value), geo: e.geo?.value || undefined,
  }));
}
