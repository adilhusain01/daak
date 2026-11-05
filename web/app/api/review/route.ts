import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { consignmentByCode, handoffsFor } from "@/lib/arkiv";
import { releaseFee, hashscan } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { logHandoff } from "@/lib/hedera";
import { isSplit, payAdvance, settleDelivered } from "@/lib/split";
import { readLog } from "@/lib/history";

/**
 * A person approves a delivery whose handoffs were recorded but not checked by AI (the safe-stop path).
 * Held handoffs are never paid from here.
 */
export async function POST(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const { code, reviewer } = (await req.json()) as { code: string; reviewer?: string };
  const c = await consignmentByCode(code);
  if (!c) return NextResponse.json({ error: "Unknown consignment" }, { status: 404 });
  const hs = await handoffsFor(code);
  const hops = new Set(hs.map((h) => h.hop));
  if (isSplit(c)) {
    // Split payout: approving pays the advance of every handed-over leg; once all hops are in, the holdbacks start their timer.
    if (hs.some((h) => h.verdict === "held")) return NextResponse.json({ error: "A hop is held; it needs a dispute, not an approval" }, { status: 409 });
    const hcs = await logHandoff({ t: "daak.reviewed", code, reviewer: reviewer ?? "operator", hops: [...hops] });
    const delivered = c.route.every((l) => hops.has(l.hop));
    if (delivered) {
      const holdback = await settleDelivered(c);
      return NextResponse.json({ released: true, delivered, holdback, hcs });
    }
    const log = await readLog();
    const advances = [];
    for (const hop of hops) advances.push(await payAdvance(c, hop, log));
    return NextResponse.json({ released: true, delivered, advances: advances.filter(Boolean), hcs });
  }
  if (!c.schedule) return NextResponse.json({ error: "No scheduled payout" }, { status: 404 });
  if (c.route.some((l) => !hops.has(l.hop))) return NextResponse.json({ error: "Not every hop has been handed over yet" }, { status: 409 });
  if (hs.some((h) => h.verdict === "held")) return NextResponse.json({ error: "A hop is held; it needs a dispute, not an approval" }, { status: 409 });
  const r = await releaseFee(c.schedule);
  const hcs = await logHandoff({ t: "daak.reviewed", code, reviewer: reviewer ?? "operator", release: r.releaseTx });
  const upi = await cashOutAll(c).catch((e) => ({ error: (e as Error).message }));
  return NextResponse.json({ released: true, payout: hashscan("transaction", r.releaseTx), hcs, upi });
}
