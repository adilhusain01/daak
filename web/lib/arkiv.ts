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
  legs: str().optional(), // drivers: the stretches they run, e.g. "KNP-LKO,LKO-GKP"
  stop: str().optional(), // shops and receivers: their bus stand id
  private: bytes().optional(), // phone and UPI ID, sealed with AES-GCM; never readable from the public record
  devicePub: str().optional(), // the public key of the phone this person signs handoffs with (P-256, SPKI, base64)
  kyc: bytes().optional(), // drivers: ID type, last 4 characters and the sealed Swarm reference of the ID photo, all sealed
  kycStatus: str().optional(), // "pending", "verified" or "rejected"; public, so shops can see the ID was checked
  timetable: str().optional(), // drivers: when their bus leaves on each stretch, e.g. "KNP-LKO@06:30/1111110"
  away: str().optional(), // drivers: dates they are not driving, "2026-11-06,2026-11-07"
});

export type BadgeRow = { uid: string; name: string; role: string; vehicle: string; legs: string[]; stop?: string; private?: string; devicePub?: string; kyc?: string; kycStatus?: string; timetable?: string; away?: string[]; key: string };

export const Consignments = defineSchema("daak.consignment", {
  code: str().indexed(),
  parcel: str().indexed(),
  label: str(),
  route: bytes(), // JSON array of legs: { hop, from, to, place, km }; str columns stop at 128 bytes
  feeRupees: i32(), // whole rupees, kept for older records; feePaise is exact
  createdAt: u64().indexed(),
  schedule: str().optional(), // Hedera scheduled payout, signed at delivery
  feePaise: i32().optional(), // the meter fee in paise: Rs 5 + Rs 0.50 a km is often a half rupee
  weight: str().optional(), // weight band id: s, m, l or xl
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
  photo: bytes().optional(), // the Swarm reference of the lid photo, sealed with AES-GCM
  zgLog: str().optional(), // root hash of the decision record on 0G Storage
});

/** A driver's own choices, newest wins. */
export const Prefs = defineSchema("daak.pref", {
  uid: str().indexed(),
  savePercent: i32(),
  at: u64().indexed(),
});

export async function putPrefs(uid: string, savePercent: number) {
  return keyOf(await arkivWrite().createEntity(Prefs, { uid, savePercent: i32(savePercent), at: u64(BigInt(Date.now())) }, { expiration: ExpirationTime.fromDays(30) }));
}

export async function getPrefs(uid: string) {
  const r = await arkivRead().select({ savePercent: true, at: true }).from(Prefs).where(eq("uid", uid)).ownedBy(owner()).orderBy(desc("at")).limit(1).fetch();
  return { savePercent: r.entities[0] ? Number(r.entities[0].savePercent.value) : 0 };
}

export type Leg = {
  hop: number; from: string; to: string; place: string; km?: number; lat?: number; lng?: number;
  /** Share of this leg's pay released at the confirmed handover, fixed at booking from the driver's record. */
  advancePct?: number;
  /** When this stretch's bus leaves and when the parcel is expected at `place` (ms), from the drivers' bus times. */
  departsAt?: number;
  etaAt?: number;
};

const chainCfg = () => rabdi({ accessKey: env.arkivAccessKey() });
export const arkivRead = () => createPublicClient({ chain: chainCfg(), transport: http() });
export const arkivWrite = () =>
  createWalletClient({ chain: chainCfg(), transport: http(), account: privateKeyToAccount(env.arkivKey()) });
export const owner = () => privateKeyToAccount(env.arkivKey()).address;

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (v: Uint8Array | `0x${string}`) =>
  typeof v === "string" ? Buffer.from(v.slice(2), "hex").toString("utf8") : new TextDecoder().decode(v);

const keyOf = (r: { entityKey: unknown; txHash: unknown }) => ({ entityKey: String(r.entityKey), txHash: String(r.txHash) });

/** Registers the phone a person signs with. Only the first phone is accepted; a replacement needs the operator. */
export async function setDevicePub(uid: string, devicePub: string, replace = false) {
  const b = await getBadge(uid);
  if (!b) throw new Error("Unknown badge");
  if (b.devicePub && !replace && b.devicePub !== devicePub) throw new Error("This badge already has a phone registered");
  if (b.devicePub === devicePub) return { entityKey: b.key, txHash: "" };
  const { txHash } = await arkivWrite().patchEntity(Badges, b.key as `0x${string}`, { set: { devicePub } });
  return { entityKey: b.key, txHash: String(txHash) };
}

/** A driver's bus times and days off, patched in place. */
export async function setDriverTimes(uid: string, set: { timetable?: string; away?: string[] }) {
  const b = await getBadge(uid);
  if (!b) throw new Error("Unknown badge");
  const values = { ...(set.timetable != null ? { timetable: set.timetable } : {}), ...(set.away != null ? { away: set.away.slice(-6).join(",") } : {}) };
  const { txHash } = await arkivWrite().patchEntity(Badges, b.key as `0x${string}`, { set: values });
  return { entityKey: b.key, txHash: String(txHash) };
}

/** Replaces a booking's route (a declined stretch handed to the next driver, or times re-planned). */
export async function patchRoute(code: string, route: Leg[]) {
  const r = await arkivRead().select({ $key: true }).from(Consignments).where(eq("code", code)).ownedBy(owner()).orderBy(desc("createdAt")).limit(1).fetch();
  const e = r.entities[0];
  if (!e) throw new Error("Unknown consignment");
  return keyOf(await arkivWrite().patchEntity(Consignments, String(e.$key) as `0x${string}`, { set: { route: enc(JSON.stringify(route)) } }));
}

/** The operator's decision on a driver's ID. */
export async function setKycStatus(uid: string, kycStatus: "verified" | "rejected") {
  const b = await getBadge(uid);
  if (!b?.kyc) throw new Error("No ID on file for this badge");
  const { txHash } = await arkivWrite().patchEntity(Badges, b.key as `0x${string}`, { set: { kycStatus } });
  return { entityKey: b.key, txHash: String(txHash) };
}

/** Creates the badge, or updates the existing one in place (re-joining, changing stretches or UPI ID). */
export async function putBadge(b: { uid: string; name: string; role: string; vehicle?: string; legs?: string[]; stop?: string; private?: string; kyc?: string; timetable?: string }) {
  const values = {
    uid: b.uid, name: b.name, role: b.role, vehicle: b.vehicle ?? "", legs: (b.legs ?? []).join(","), stop: b.stop ?? "", private: enc(b.private ?? ""),
    ...(b.kyc ? { kyc: enc(b.kyc), kycStatus: "pending" } : {}),
    ...(b.timetable ? { timetable: b.timetable } : {}),
  };
  const existing = await getBadge(b.uid).catch(() => null);
  if (existing) {
    const { txHash } = await arkivWrite().patchEntity(Badges, existing.key as `0x${string}`, { set: values });
    return { entityKey: existing.key, txHash: String(txHash) };
  }
  return keyOf(await arkivWrite().createEntity(Badges, values, { expiration: ExpirationTime.fromDays(30) }));
}

type BadgeEntity = { $key: unknown; uid: { value: string }; name: { value: string }; role: { value: string }; vehicle: { value: string }; legs?: { value: string }; stop?: { value: string }; private?: { value: Uint8Array | `0x${string}` }; devicePub?: { value: string }; kyc?: { value: Uint8Array | `0x${string}` }; kycStatus?: { value: string }; timetable?: { value: string }; away?: { value: string } };
const toBadge = (b: BadgeEntity): BadgeRow => ({
  key: String(b.$key), uid: b.uid.value, name: b.name.value, role: b.role.value, vehicle: b.vehicle.value,
  legs: (b.legs?.value ?? "").split(",").filter(Boolean), stop: b.stop?.value || undefined,
  private: b.private ? dec(b.private.value) || undefined : undefined,
  devicePub: b.devicePub?.value || undefined,
  kyc: b.kyc ? dec(b.kyc.value) || undefined : undefined,
  kycStatus: b.kycStatus?.value || undefined,
  timetable: b.timetable?.value || undefined,
  away: (b.away?.value ?? "").split(",").filter(Boolean),
});

export async function badgesByRole(role: string): Promise<BadgeRow[]> {
  const r = await arkivRead().select({ $key: true, uid: true, name: true, role: true, vehicle: true, legs: true, stop: true, private: true, devicePub: true, kyc: true, kycStatus: true, timetable: true, away: true }).from(Badges)
    .where(eq("role", role)).ownedBy(owner()).limit(100).fetch();
  return r.entities.map((b) => toBadge(b as BadgeEntity));
}

export async function getBadge(uid: string): Promise<BadgeRow | null> {
  const r = await arkivRead().select({ $key: true, uid: true, name: true, role: true, vehicle: true, legs: true, stop: true, private: true, devicePub: true, kyc: true, kycStatus: true, timetable: true, away: true }).from(Badges)
    .where(eq("uid", uid)).ownedBy(owner()).limit(1).fetch();
  const b = r.entities[0];
  return b ? toBadge(b as BadgeEntity) : null;
}

export async function putConsignment(c: { code: string; parcel: string; label: string; route: Leg[]; feeRupees: number; schedule?: string; weight?: string }) {
  return keyOf(await arkivWrite().createEntity(
    Consignments,
    { ...c, route: enc(JSON.stringify(c.route)), feeRupees: i32(Math.floor(c.feeRupees)), feePaise: i32(Math.round(c.feeRupees * 100)), createdAt: u64(BigInt(Date.now())), schedule: c.schedule ?? "", weight: c.weight ?? "s" },
    { expiration: ExpirationTime.fromDays(30) },
  ));
}

type ConsignmentRow = { code: string; parcel: string; label: string; route: Leg[]; feeRupees: number; createdAt: number; schedule?: string; weight?: string };

function toConsignment(e: { code: { value: string }; parcel: { value: string }; label: { value: string }; route: { value: Uint8Array | `0x${string}` }; feeRupees: { value: number }; createdAt: { value: bigint }; schedule?: { value: string }; feePaise?: { value: number }; weight?: { value: string } }): ConsignmentRow {
  return { code: e.code.value, parcel: e.parcel.value, label: e.label.value, route: JSON.parse(dec(e.route.value)), feeRupees: e.feePaise?.value ? Number(e.feePaise.value) / 100 : Number(e.feeRupees.value), createdAt: Number(e.createdAt.value), schedule: e.schedule?.value || undefined, weight: e.weight?.value || undefined };
}

/** The newest consignment for a parcel tag (a tag can be reused for a later parcel). */
export async function consignmentByParcel(parcel: string) {
  const r = await arkivRead().select({ code: true, parcel: true, label: true, route: true, feeRupees: true, createdAt: true, schedule: true, feePaise: true, weight: true })
    .from(Consignments).where(eq("parcel", parcel)).ownedBy(owner()).orderBy(desc("createdAt")).limit(1).fetch();
  return r.entities[0] ? toConsignment(r.entities[0]) : null;
}

export async function consignmentByCode(code: string) {
  const r = await arkivRead().select({ code: true, parcel: true, label: true, route: true, feeRupees: true, createdAt: true, schedule: true, feePaise: true, weight: true })
    .from(Consignments).where(eq("code", code)).ownedBy(owner()).orderBy(desc("createdAt")).limit(1).fetch();
  return r.entities[0] ? toConsignment(r.entities[0]) : null;
}

export async function recentConsignments() {
  const r = await arkivRead().select({ code: true, parcel: true, label: true, route: true, feeRupees: true, createdAt: true, schedule: true, feePaise: true, weight: true })
    .from(Consignments).ownedBy(owner()).orderBy(desc("createdAt")).limit(20).fetch();
  return r.entities.map(toConsignment);
}

export type HandoffRow = {
  key: string; code: string; hop: number; verdict: string; place: string; fromBadge: string; toBadge: string;
  at: number; zgRequestId: string; hcs: string; photoSha256: string; reason: string; geo?: string; photo?: string; zgLog?: string;
};

export async function writeHandoff(h: Omit<HandoffRow, "key">) {
  return keyOf(await arkivWrite().createEntity(
    Handoffs,
    { ...h, reason: enc(h.reason), hop: i32(h.hop), at: u64(BigInt(h.at)), geo: h.geo ?? "", photo: enc(h.photo ?? ""), zgLog: h.zgLog ?? "" },
    { expiration: ExpirationTime.fromDays(1) },
  ));
}

export async function handoffsFor(code: string): Promise<HandoffRow[]> {
  const r = await arkivRead()
    .select({ $key: true, code: true, hop: true, verdict: true, place: true, fromBadge: true, toBadge: true, at: true, zgRequestId: true, hcs: true, photoSha256: true, reason: true, geo: true, photo: true, zgLog: true })
    .from(Handoffs).where(and(eq("code", code))).ownedBy(owner()).orderBy(desc("at")).limit(50).fetch();
  return r.entities.map((e) => ({
    key: String(e.$key), code: e.code.value, hop: Number(e.hop.value), verdict: e.verdict.value, place: e.place.value,
    fromBadge: e.fromBadge.value, toBadge: e.toBadge.value, at: Number(e.at.value), zgRequestId: e.zgRequestId.value,
    hcs: e.hcs.value, photoSha256: e.photoSha256.value, reason: dec(e.reason.value), geo: e.geo?.value || undefined, photo: e.photo ? dec(e.photo.value) || undefined : undefined, zgLog: e.zgLog?.value || undefined,
  }));
}

/**
 * A shop's standing order: the same receiver and drivers on set weekdays. Daak's agent books and pays it
 * each morning; the shop only taps that day's parcel to attach it.
 */
export const StandingOrders = defineSchema("daak.standing", {
  id: str().indexed(),
  sender: str().indexed(),
  receiver: str(),
  drivers: str(), // badge uids, one per stretch, comma separated
  days: str(), // seven characters, Monday first: "1111100" is Monday to Friday
  active: i32(),
  lastRun: str(), // the Indian date it last booked, YYYY-MM-DD
  lastCode: str(),
  createdAt: u64(),
  weight: str().optional(), // weight band of the daily parcel
});

export type StandingRow = { key: string; id: string; sender: string; receiver: string; drivers: string[]; days: string; active: boolean; lastRun: string; lastCode: string; createdAt: number; weight: string };
const STANDING_COLS = { $key: true, id: true, sender: true, receiver: true, drivers: true, days: true, active: true, lastRun: true, lastCode: true, createdAt: true, weight: true } as const;
type StandingEntity = { $key: unknown; id: { value: string }; sender: { value: string }; receiver: { value: string }; drivers: { value: string }; days: { value: string }; active: { value: number }; lastRun: { value: string }; lastCode: { value: string }; createdAt: { value: bigint }; weight?: { value: string } };
const toStanding = (e: StandingEntity): StandingRow => ({
  key: String(e.$key), id: e.id.value, sender: e.sender.value, receiver: e.receiver.value, drivers: e.drivers.value.split(",").filter(Boolean),
  days: e.days.value, active: Number(e.active.value) === 1, lastRun: e.lastRun.value, lastCode: e.lastCode.value, createdAt: Number(e.createdAt.value), weight: e.weight?.value || "s",
});

export async function putStanding(o: { id: string; sender: string; receiver: string; drivers: string[]; days: string; weight: string }) {
  return keyOf(await arkivWrite().createEntity(
    StandingOrders,
    { ...o, drivers: o.drivers.join(","), active: i32(1), lastRun: "", lastCode: "", createdAt: u64(BigInt(Date.now())) },
    { expiration: ExpirationTime.fromDays(30) },
  ));
}

export async function standingOrders(sender?: string): Promise<StandingRow[]> {
  const q = arkivRead().select(STANDING_COLS).from(StandingOrders);
  const r = await (sender ? q.where(eq("sender", sender)) : q).ownedBy(owner()).limit(100).fetch();
  return r.entities.map((e) => toStanding(e as StandingEntity)).sort((a, b) => b.createdAt - a.createdAt);
}

export async function patchStanding(key: string, set: { active?: boolean; lastRun?: string; lastCode?: string; days?: string }) {
  const values = { ...(set.days != null ? { days: set.days } : {}), ...(set.active != null ? { active: i32(set.active ? 1 : 0) } : {}), ...(set.lastRun != null ? { lastRun: set.lastRun } : {}), ...(set.lastCode != null ? { lastCode: set.lastCode } : {}) };
  return keyOf(await arkivWrite().patchEntity(StandingOrders, key as `0x${string}`, { set: values }));
}

/** Puts the parcel tag on a booking made before the parcel existed (a standing order's morning booking). */
export async function attachParcel(code: string, parcel: string) {
  const r = await arkivRead().select({ $key: true, parcel: true }).from(Consignments).where(eq("code", code)).ownedBy(owner()).orderBy(desc("createdAt")).limit(1).fetch();
  const e = r.entities[0];
  if (!e) throw new Error("Unknown consignment");
  return keyOf(await arkivWrite().patchEntity(Consignments, String(e.$key) as `0x${string}`, { set: { parcel } }));
}
