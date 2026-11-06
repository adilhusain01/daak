import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { consignmentByParcel, handoffsFor, getBadge } from "@/lib/arkiv";
import { badgeHash } from "@/lib/history";
import { tappedPerson, openLeg } from "@/lib/rules";

/**
 * What the phone shows right after a parcel is tapped: which consignment it is and who should take it next.
 * The next receiver is sent as a hash of their badge, so the app can warn about a wrong badge before sending.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(_req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const c = await consignmentByParcel(uid);
  // Not a parcel: if it is someone's badge, say whose, so the phone can ask for the parcel instead of calling it unbooked.
  if (!c) return NextResponse.json({ registered: false, person: tappedPerson(await getBadge(uid).catch(() => null)) }, { status: 404 });
  const hs = await handoffsFor(c.code);
  const leg = openLeg(c.route, hs);
  const [to, from] = leg ? await Promise.all([getBadge(leg.to).catch(() => null), getBadge(leg.from).catch(() => null)]) : [null, null];
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
      fromName: from?.name?.split(",")[0] ?? "the giver",
      fromRole: from?.role ?? "driver",
    },
  });
}
