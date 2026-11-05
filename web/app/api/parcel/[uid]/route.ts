import { NextResponse } from "next/server";
import { consignmentByParcel, handoffsFor, getBadge } from "@/lib/arkiv";
import { badgeHash } from "@/lib/history";

/**
 * What the phone shows right after a parcel is tapped: which consignment it is and who should take it next.
 * The next receiver is sent as a hash of their badge, so the app can warn about a wrong badge before sending.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  const uid = decodeURIComponent((await ctx.params).uid);
  const c = await consignmentByParcel(uid);
  if (!c) return NextResponse.json({ registered: false }, { status: 404 });
  const hs = await handoffsFor(c.code);
  const done = new Set(hs.filter((h) => h.verdict !== "held").map((h) => h.hop));
  const leg = c.route.find((l) => !done.has(l.hop));
  const to = leg ? await getBadge(leg.to).catch(() => null) : null;
  return NextResponse.json({
    registered: true,
    code: c.code,
    label: c.label,
    stops: c.route.length,
    delivered: !leg,
    next: leg && {
      hop: leg.hop,
      place: leg.place,
      km: leg.km ?? null,
      fromHash: badgeHash(leg.from),
      toHash: badgeHash(leg.to),
      toName: to?.name?.split(",")[0] ?? "the next carrier",
      toRole: to?.role ?? "driver",
    },
  });
}
