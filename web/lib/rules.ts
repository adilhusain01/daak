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
