import { NextResponse } from "next/server";
import { consignmentByCode, handoffsFor } from "@/lib/arkiv";

/** What the retailer's tracking page shows, read straight from Arkiv. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const c = await consignmentByCode(code);
  if (!c) return NextResponse.json({ error: "Unknown consignment" }, { status: 404 });
  const handoffs = await handoffsFor(code);
  return NextResponse.json({
    code: c.code, label: c.label, feeRupees: c.feeRupees,
    route: c.route.map((l) => ({ hop: l.hop, place: l.place, km: l.km ?? null })),
    handoffs: handoffs.map(({ fromBadge, toBadge, ...h }) => h),
  });
}
