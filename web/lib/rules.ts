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

/** The share of each booking fee that pays for the agent's own sealed checks. */
export const COMPUTE_SHARE = 0.02;

/**
 * What one booking puts towards compute: COMPUTE_SHARE of its booking fee, in paise (moved in dINR on Hedera) and the
 * same value in 0G at the live price (deposited on 0G), inside the daily cap and keeping gas in the wallet.
 */
export function computeEarmark(o: { bookingFeeRupees: number; inrPer0g: number; wallet: number; toppedToday: number }) {
  const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
  const paiseWanted = Math.round(o.bookingFeeRupees * COMPUTE_SHARE * 100);
  // The 0G must match the rupees actually moved on Hedera, so it is converted from the rounded paise.
  const want = r4(paiseWanted / 100 / o.inrPer0g);
  const zg = r4(Math.min(want, Math.max(0, COMPUTE.DAY_CAP - o.toppedToday), Math.max(0, o.wallet - COMPUTE.WALLET_KEEP)));
  if (zg < 0.001) return { paise: 0, zg: 0 };
  return { paise: zg === want ? paiseWanted : Math.round(zg * o.inrPer0g * 100), zg };
}

/**
 * The reason a handoff was held, in Hindi, for the voice at the stand and the Hindi screen. It follows the English
 * reason the server wrote; anything unforeseen falls back to "payment held, Daak will check".
 */
export function heldReasonHi(en: string): string {
  let m: RegExpMatchArray | null;
  if (/badges are not the drivers booked/i.test(en)) return "ये बैज इस पड़ाव के बुक किए गए ड्राइवरों के नहीं हैं। भुगतान रुका है।";
  if (/No GPS fix/i.test(en)) return "फ़ोन की जगह नहीं मिली, इसलिए हैंडऑफ़ बस अड्डे पर दर्ज नहीं हुआ। भुगतान रुका है।";
  if ((m = en.match(/happened (\d+) m from/i))) return `हैंडऑफ़ बस अड्डे से ${m[1]} मीटर दूर हुआ। भुगतान रुका है।`;
  if ((m = en.match(/reads "([^"]*)", expected ([A-Z0-9-]+)/i))) return `पार्सल पर कोड ${m[1] || "पढ़ा नहीं गया"} है, ${m[2]} होना चाहिए। भुगतान रुका है।`;
  if (/looks damaged/i.test(en)) return "पार्सल फटा हुआ दिखता है। भुगतान रुका है।";
  if (/looks opened/i.test(en)) return "पार्सल खुला हुआ दिखता है। भुगतान रुका है।";
  if (/code has expired/i.test(en)) return "कोड पुराना हो गया। उनकी स्क्रीन से नया कोड स्कैन कीजिए।";
  if (/already used/i.test(en)) return "यह कोड पहले इस्तेमाल हो चुका है। नया कोड स्कैन कीजिए।";
  if (/belongs to someone else/i.test(en)) return "यह कोड इस हैंडऑफ़ वाले व्यक्ति का नहीं है।";
  if (/Signature check failed|not signed by/i.test(en)) return "यह हैंडऑफ़ पंजीकृत फ़ोन से नहीं आया। भुगतान रुका है।";
  return "भुगतान रुका है। Daak इसकी जाँच करेगा।";
}

/** The operator passcode: at most 5 wrong tries in 15 minutes. */
export function loginAllowed(failures: number[], now: number) {
  return failures.filter((t) => now - t < 15 * 60_000).length < 5;
}

/** Adds newly read log messages to the cached ones, by sequence number, without repeats. */
export function mergeBySeq<T extends { seq: number }>(cached: T[], fresh: T[]): T[] {
  const last = cached.at(-1)?.seq ?? 0;
  return [...cached, ...fresh.filter((m) => m.seq > last)];
}

/**
 * Whether a code read off a lid is the parcel's code. People write codes by hand, over two lines, with or without
 * hyphens and spaces, in any case; only the letters and digits count.
 */
export function sameCode(read: string, expected: string): boolean {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return norm(read).length > 0 && norm(read) === norm(expected);
}

/**
 * Which stops 0G may look at again: not checked yet, held by the unsealed backup, or held only because the code on
 * the lid did not match (a misread, or the old letter-for-letter compare). Damage and wrong people or place stay held.
 */
export function recheckable(verdict: string, reason: string): boolean {
  return verdict === "unchecked" || (verdict === "held" && (reason.startsWith("Backup check") || reason.startsWith("Code on the parcel reads")));
}

/** Whose badge a tapped tag is, as others may see it (name before the comma, and role); null when it is no one's. */
export function tappedPerson(b: { name: string; role: string } | null): { name: string; role: string } | null {
  return b ? { name: b.name.split(",")[0].trim(), role: b.role } : null;
}

/**
 * The log with each handover's verdict replaced by its latest recheck, if 0G looked again: a held handover that a
 * recheck cleared is green on the driver's record. Recheck messages are kept as they are.
 */
export function afterRechecks<T extends { t: string; code?: string; hop?: number; verdict?: string; ts: number }>(log: T[]): T[] {
  const latest = new Map<string, { verdict?: string; ts: number }>();
  for (const m of log) {
    if (m.t !== "daak.recheck") continue;
    const k = `${m.code}#${m.hop}`, seen = latest.get(k);
    if (!seen || m.ts >= seen.ts) latest.set(k, { verdict: m.verdict, ts: m.ts });
  }
  return log.map((m) => {
    const r = m.t === "daak.handoff" ? latest.get(`${m.code}#${m.hop}`) : undefined;
    return r && r.ts >= m.ts ? { ...m, verdict: r.verdict } : m;
  });
}
