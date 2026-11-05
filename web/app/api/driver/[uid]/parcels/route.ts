import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { recentConsignments, handoffsFor, getBadge } from "@/lib/arkiv";
import { badgeHash, readLog } from "@/lib/history";
import { legPay } from "@/lib/split";

/** What a person should do next: parcels where they are the giver or the taker of the next handoff. */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(_req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const since = Number(process.env.DATA_SINCE ?? 0);
  const list = (await recentConsignments()).filter((c) => c.createdAt >= since);
  const out = [];
  const offers = [];
  const log = await readLog().catch(() => []);
  const answered = new Set(log.filter((m) => m.t === "daak.job" && (m as { driver?: string }).driver === badgeHash(uid)).map((m) => `${m.code}#${m.hop}`));
  for (const c of list) {
    if (!c.route.some((l) => l.from === uid || l.to === uid)) continue;
    const done = new Set((await handoffsFor(c.code)).filter((h) => h.verdict !== "held").map((h) => h.hop));
    // A new job: this driver carries a stretch not yet handed over and has not answered the offer.
    const mine = c.route.find((l) => l.from === uid && (l.km ?? 0) > 0);
    if (mine && !done.has(mine.hop) && !answered.has(`${c.code}#${mine.hop}`)) {
      const pay = legPay(c).find((p) => p.hop === mine.hop);
      const start = c.route.find((l) => l.to === uid)?.place ?? "";
      offers.push({
        code: c.code, label: c.label, place: mine.place, action: "offer", hop: mine.hop,
        text: `${start.split(",")[0]} to ${mine.place.split(",")[0]}, ${mine.km} km, ₹${((pay?.units ?? 0) / 100).toFixed(2)} (${pay?.pct ?? 50}% at handover)`,
      });
    }
    const leg = c.route.find((l) => !done.has(l.hop));
    if (!leg || (leg.from !== uid && leg.to !== uid)) continue;
    const other = await getBadge(leg.from === uid ? leg.to : leg.from).catch(() => null);
    const who = other?.name.split(",")[0] ?? "the other person";
    out.push({
      code: c.code, label: c.label, place: leg.place,
      action: leg.from === uid ? "give" : "take",
      text: leg.from === uid ? `Hand ${c.code} to ${who} at ${leg.place}` : `Take ${c.code} from ${who} at ${leg.place}`,
    });
  }
  return NextResponse.json({ parcels: [...offers, ...out] });
}
