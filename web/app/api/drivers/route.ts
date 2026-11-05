import { NextResponse } from "next/server";
import { badgesByRole } from "@/lib/arkiv";
import { readLog, workHistory, badgeHash } from "@/lib/history";

/** Every driver ranked by their proven record, computed from the public Hedera log. */
export async function GET() {
  const [drivers, log] = await Promise.all([badgesByRole("driver"), readLog()]);
  const rows = await Promise.all(drivers.map(async (d) => ({ name: d.name, vehicle: d.vehicle, id: badgeHash(d.uid), idChecked: d.kycStatus === "verified", ...(await workHistory(d.uid, log)) })));
  rows.sort((a, b) => b.proven - a.proven || b.cleanRate - a.cleanRate || b.km - a.km);
  return NextResponse.json({ drivers: rows });
}
