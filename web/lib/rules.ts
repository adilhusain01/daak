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
