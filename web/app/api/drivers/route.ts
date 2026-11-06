import { NextResponse } from "next/server";
import { badgesByRole } from "@/lib/arkiv";
import { readLog, workHistory, badgeHash } from "@/lib/history";

/** Every driver ranked by their proven record, computed from the public Hedera log. */
export async function GET() {
  const [drivers, log] = await Promise.all([badgesByRole("driver"), readLog()]);
  // Public: the record a shop chooses by (proven, km, clean, tier, ID checked), never what a driver earned or saved.
  const rows = await Promise.all(drivers.map(async (d) => {
    const w = await workHistory(d.uid, log);
    return { name: d.name, vehicle: d.vehicle, id: badgeHash(d.uid), idChecked: d.kycStatus === "verified", proven: w.proven, held: w.held, km: w.km, cleanRate: w.cleanRate, tier: w.tier, advanceReady: w.advance.eligibleRupees > 0 };
  }));
  rows.sort((a, b) => b.proven - a.proven || b.cleanRate - a.cleanRate || b.km - a.km);
  return NextResponse.json({ drivers: rows });
}
