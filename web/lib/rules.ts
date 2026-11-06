/**
 * Daak's money and trust rules as plain functions, so they can be tested without a chain.
 * Amounts in dINR units: 1 rupee = 100 units.
 */

/** Splits a fee by kilometres; rounding leftovers go to the last leg, so the parts always add up to the fee. */
export function splitByKm(feeUnits: number, legs: { badge: string; km: number }[]) {
  const total = legs.reduce((s, l) => s + l.km, 0);
  if (!legs.length || total <= 0) return [];
  const shares = legs.map((l) => ({ badge: l.badge, km: l.km, units: Math.floor((feeUnits * l.km) / total) }));
  shares[shares.length - 1].units += feeUnits - shares.reduce((s, x) => s + x.units, 0);
  return shares;
}

/** The part of a payout a driver chose to save in Bachat, rounded down to whole units. */
export const bachatUnits = (units: number, percent: number) => Math.floor((units * Math.max(0, Math.min(20, percent))) / 100);

/** The fuel advance a driver's public record unlocks, with the reason when it is zero. */
export function advanceFor(r: { proven: number; heldRecently: boolean; cleanRate: number; earned30dRupees: number }) {
  if (r.proven < 2) return { eligibleRupees: 0, reason: "Needs 2 proven deliveries" };
  if (r.heldRecently) return { eligibleRupees: 0, reason: "A recent handoff was held" };
  if (r.cleanRate < 0.9) return { eligibleRupees: 0, reason: "Clean record below 90%" };
  const limit = Math.min(5000, Math.floor((r.earned30dRupees * 0.25) / 10) * 10);
  return limit > 0
    ? { eligibleRupees: limit, reason: "25% of the last 30 days' proven earnings, up to Rs 5,000" }
    : { eligibleRupees: 0, reason: "No paid deliveries in the last 30 days" };
}

/**
 * How much of a leg's pay a driver gets at the confirmed handover, by their public record.
 * The rest is held until delivery is confirmed, and repays the customer if that driver's leg went wrong.
 */
export function tierFor(r: { proven: number; cleanRate: number; heldRecently: boolean }) {
  if (r.proven >= 50 && r.cleanRate >= 0.98 && !r.heldRecently) return { name: "Trusted", advancePct: 90 };
  if (r.proven >= 10 && !r.heldRecently) return { name: "Proven", advancePct: 70 };
  return { name: "New", advancePct: 50 };
}

/** Splits one leg's pay into what is paid at handover and what is held until delivery. */
export function splitAdvance(units: number, advancePct: number) {
  const advance = Math.floor((units * advancePct) / 100);
  return { advance, holdback: units - advance };
}

/** The protection pool gets this many points of the meter from every booking (out of Daak's booking fee). */
export const POOL_POINTS = Number(process.env.POOL_POINTS ?? 1);
export const poolUnits = (meterUnits: number) => Math.floor((meterUnits * POOL_POINTS) / 100);

/** What the pool pays a shop for a lost or damaged parcel: its declared value, up to the cap, after the liable holdback. */
export function poolPayout(declaredRupees: number, liableHoldbackRupees: number, capRupees = Number(process.env.POOL_CAP_RUPEES ?? 2000)) {
  return Math.max(0, Math.min(capRupees, declaredRupees) - liableHoldbackRupees);
}

/** The calendar date in India (IST, UTC+5:30) as YYYY-MM-DD: standing orders run on India's days. */
export const istDate = (now = new Date()) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/**
 * Is a standing order due? `days` is seven characters, Monday first ("1111100" is Monday to Friday).
 * It books once per Indian day.
 */
export function standingDue(o: { days: string; lastRun: string }, now = new Date()) {
  const today = istDate(now);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return o.days[weekday] === "1" && o.lastRun !== today;
}

/** The most GPS accuracy a phone may claim; a bigger claim would let any handoff pass the stand check. */
export const MAX_ACCURACY_M = 200;

/**
 * Is the handoff at the stand? Within `radiusM` of the stand, allowing the phone's accuracy up to 200 m.
 * radiusM 0 turns the check off (a demo away from the real stands); a stand without coordinates is not checked.
 */
export function placeCheck(spot: { lat: number; lng: number; acc: number } | null, stand: { lat: number; lng: number } | null, radiusM: number) {
  if (!radiusM || !stand) return { ok: true, metres: 0 };
  if (!spot) return { ok: false, metres: null as number | null };
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(stand.lat - spot.lat) / 2) ** 2 + Math.cos(rad(spot.lat)) * Math.cos(rad(stand.lat)) * Math.sin(rad(stand.lng - spot.lng) / 2) ** 2;
  const metres = 2 * R * Math.asin(Math.sqrt(h));
  return { ok: metres - Math.min(Math.max(spot.acc, 0), MAX_ACCURACY_M) <= radiusM, metres: Math.round(metres) };
}

/** What 0G read off a driver's ID photo. */
export type IdReading = { docType: string; name: string; last4: string; vehicleClasses: string; masked: boolean; edited: boolean };

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean);
/** Licence classes that allow a bus: transport, heavy passenger or heavy goods. */
const BUS_CLASSES = /\b(TRANS|TR|HPMV|HTV|HGMV|PSV|BUS|HMV)\b/i;

/**
 * Compares 0G's reading of an ID with what the driver claimed: the ID type, every word of the claimed name present on
 * the card, the last 4 characters, a licence class that allows a bus, Aadhaar masked, and nothing that looks edited.
 * A null means the check does not apply to this kind of ID. The operator still decides.
 */
export function compareId(read: IdReading, claimed: { idType: string; name: string; last4: string }) {
  const onCard = new Set(letters(read.name));
  return {
    typeOk: read.docType === claimed.idType,
    nameOk: letters(claimed.name).length > 0 && letters(claimed.name).every((w) => onCard.has(w)),
    last4Ok: read.last4.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-4) === claimed.last4.toUpperCase(),
    busOk: claimed.idType === "dl" ? BUS_CLASSES.test(read.vehicleClasses) : null,
    maskOk: claimed.idType === "aadhaar_masked" ? read.masked : null,
    editedOk: !read.edited,
  };
}

export const VOUCHES_PER_30_DAYS = 3;
const DAY = 86_400_000;

/**
 * Whether someone may vouch now, read from the public log (badges as hashes). At most three vouches in 30 days, and
 * none for 90 days after someone they vouched for is found responsible for a damaged or lost parcel.
 */
export function vouchStanding(log: { t: string; ts: number; [k: string]: unknown }[], voucher: string, now: number): { ok: true; left: number } | { ok: false; why: string } {
  const mine = log.filter((m) => m.t === "daak.vouched" && m.by === voucher);
  const vouchedFor = new Set(mine.map((m) => m.who));
  const responsible = log.filter((m) => m.t === "daak.refunded" && m.liableHop != null && now - m.ts < 90 * DAY).map((r) =>
    log.find((h) => h.t === "daak.handoff" && h.code === r.code && h.hop === r.liableHop)?.from);
  if (responsible.some((d) => d && vouchedFor.has(d))) return { ok: false, why: "Someone you vouched for was found responsible for a damaged parcel. You can vouch again after 90 days." };
  const recent = mine.filter((m) => now - m.ts < 30 * DAY).length;
  if (recent >= VOUCHES_PER_30_DAYS) return { ok: false, why: `You have vouched for ${VOUCHES_PER_30_DAYS} people in the last 30 days. Wait before vouching again.` };
  return { ok: true, left: VOUCHES_PER_30_DAYS - recent };
}

/** The agent's own 0G compute account, in 0G: top up below LOW, a TOPUP at a time, at most DAY_CAP a day. */
export const COMPUTE = { LOW: 1, TOPUP: 0.25, DAY_CAP: 1, PROVIDER_LOW: 0.5, PROVIDER_FILL: 1, WALLET_KEEP: 0.5 };

/**
 * What the agent moves after a booking so it can keep paying for its own sealed checks: a small deposit into its
 * compute account when that runs low (never past the daily cap, never leaving the wallet without gas), and a refill
 * of the provider's share from the account when that runs low.
 */
export function topUpPlan(s: { available: number; providerLocked: number; wallet: number; toppedToday: number }) {
  const room = Math.max(0, COMPUTE.DAY_CAP - s.toppedToday);
  const canSpend = Math.max(0, s.wallet - COMPUTE.WALLET_KEEP);
  const deposit = s.available < COMPUTE.LOW ? Math.min(COMPUTE.TOPUP, room, canSpend) : 0;
  const toProvider = s.providerLocked < COMPUTE.PROVIDER_LOW && s.available + deposit >= COMPUTE.PROVIDER_FILL ? COMPUTE.PROVIDER_FILL : 0;
  return { deposit: deposit >= 0.01 ? deposit : 0, toProvider };
}
