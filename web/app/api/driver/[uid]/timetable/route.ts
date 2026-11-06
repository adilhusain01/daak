import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge, setDriverTimes } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";
import { encodeTimetables, type Timetable } from "@/lib/timetable";

/** A driver publishes when their bus leaves on each stretch they run, and on which days. */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const { timetable } = (await req.json()) as { timetable: Record<string, Timetable> };
  const b = await getBadge(uid);
  if (!b || b.role !== "driver") return NextResponse.json({ error: "Only drivers have bus times" }, { status: 400 });
  for (const [leg, t] of Object.entries(timetable ?? {})) {
    if (!b.legs.includes(leg)) return NextResponse.json({ error: `You do not run ${leg}` }, { status: 400 });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dep) || !/^[01]{7}$/.test(t.days)) return NextResponse.json({ error: "Enter the time as HH:MM, like 06:30" }, { status: 400 });
  }
  const arkiv = await setDriverTimes(uid, { timetable: encodeTimetables(timetable ?? {}) });
  await logHandoff({ t: "daak.timetable", id: badgeHash(uid), legs: Object.keys(timetable ?? {}) });
  return NextResponse.json({ ok: true, arkiv });
}
