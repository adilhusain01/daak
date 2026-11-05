import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { recentConsignments, handoffsFor, getBadge } from "@/lib/arkiv";

/** What a person should do next: parcels where they are the giver or the taker of the next handoff. */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(_req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const list = await recentConsignments();
  const out = [];
  for (const c of list) {
    if (!c.route.some((l) => l.from === uid || l.to === uid)) continue;
    const done = new Set((await handoffsFor(c.code)).filter((h) => h.verdict !== "held").map((h) => h.hop));
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
  return NextResponse.json({ parcels: out });
}
