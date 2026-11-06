import { NextResponse } from "next/server";
import { chain } from "@/lib/hedera";
import { pageParams, parcelPage } from "@/lib/parcels";

/**
 * Every delivery, public and read-only, a page at a time. `?page=1&size=20&filter=paid&q=KNP`
 * No photos, no badges, no phone, UPI or bank details: those stay behind the operator passcode.
 */
export async function GET(req: Request) {
  const { counts, ...rest } = await parcelPage({ ...pageParams(req.url), publicOnly: true });
  // "Needs the operator" is an internal queue; the public sees the same parcels as on the way.
  return NextResponse.json({ chain: chain(), counts: { all: counts.all, transit: counts.transit, paid: counts.paid }, ...rest, rows: rest.rows.map(({ needsYou: _n, ...r }) => r) },
    { headers: { "Cache-Control": "public, s-maxage=20" } });
}
