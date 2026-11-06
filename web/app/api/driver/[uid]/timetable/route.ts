import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge, setDriverTimes } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";
import { encodeTimetables, type Timetable } from "@/lib/timetable";
import { network } from "@/lib/network";
import { verifyHandoff } from "@/lib/signing";

/**
 * A driver publishes which stretches they run and when their bus leaves on each, and on which days. Changing the
 * stretches must be signed by the driver's registered phone. UPI ID, phone and name are not editable here: changing
 * where pay goes stays with the operator.
 */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const { timetable, legs, at, sig } = (await req.json()) as { timetable: Record<string, Timetable>; legs?: string[]; at?: number; sig?: string };
  const b = await getBadge(uid);
  if (!b || b.role !== "driver") return NextResponse.json({ error: "Only drivers have bus times" }, { status: 400 });
  if (legs) {
    if (!legs.length || !legs.every((l) => network().legs.some((x) => x.id === l))) return NextResponse.json({ error: "Choose at least one stretch from the network" }, { status: 400 });
    if (!b.devicePub || !at || Math.abs(Date.now() - at) > 10 * 60_000 || !sig || !verifyHandoff(b.devicePub, `daak.route|${uid}|${legs.join(",")}|${at}`, sig)) {
      return NextResponse.json({ error: "Changing your stretches must come from your registered phone." }, { status: 401 });
    }
    b.legs = legs;
  }
  for (const [leg, t] of Object.entries(timetable ?? {})) {
    if (!b.legs.includes(leg)) return NextResponse.json({ error: `You do not run ${leg}` }, { status: 400 });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dep) || !/^[01]{7}$/.test(t.days)) return NextResponse.json({ error: "Enter the time as HH:MM, like 06:30" }, { status: 400 });
  }
  const arkiv = await setDriverTimes(uid, { timetable: encodeTimetables(timetable ?? {}), ...(legs ? { legs } : {}) });
  await logHandoff({ t: "daak.timetable", id: badgeHash(uid), legs: legs ?? Object.keys(timetable ?? {}) });
  return NextResponse.json({ ok: true, arkiv });
}
