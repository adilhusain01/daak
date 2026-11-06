import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge, recentConsignments, setDriverTimes } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";
import { badgeHash, readLog } from "@/lib/history";
import { reassign } from "@/lib/reassign";
import { istDate } from "@/lib/rules";
import { checkSignedAction } from "@/lib/signing";

/**
 * A driver is not driving today (or is again). Marking a day off hands every stretch of theirs that leaves today
 * and has not been handed over to the next driver whose bus connects.
 */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const { away, at, sig } = (await req.json()) as { away: boolean; at?: number; sig?: string };
  const b = await getBadge(uid);
  if (!b || b.role !== "driver") return NextResponse.json({ error: "Only drivers" }, { status: 400 });
  // A day off hands the driver's stretches to others, so only their own registered phone can mark it.
  if (!checkSignedAction({ devicePub: b.devicePub, message: `daak.away|${uid}|${away}|${at}`, at: Number(at), sig, now: Date.now() })) {
    return NextResponse.json({ error: "This did not come from your registered phone." }, { status: 401 });
  }
  const today = istDate();
  const days = new Set(b.away ?? []);
  if (away) days.add(today); else days.delete(today);
  await setDriverTimes(uid, { away: [...days].sort() });
  const handedOn = [];
  if (away) {
    const log = await readLog();
    for (const c of await recentConsignments()) {
      const leg = c.route.find((l) => l.from === uid && (l.km ?? 0) > 0);
      if (!leg || (leg.departsAt && istDate(new Date(leg.departsAt)) !== today)) continue;
      await logHandoff({ t: "daak.job", code: c.code, hop: leg.hop, driver: badgeHash(uid), decision: "decline", reason: "not driving today" });
      const r = await reassign(c, leg.hop, log).catch(() => null);
      handedOn.push({ code: c.code, to: r?.name ?? null });
    }
  }
  return NextResponse.json({ ok: true, awayToday: away, handedOn });
}
