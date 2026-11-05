import { NextResponse } from "next/server";
import { consignmentByCode, handoffsFor } from "@/lib/arkiv";
import { releaseFee, hashscan } from "@/lib/payout";
import { logHandoff } from "@/lib/hedera";

/**
 * A person approves a delivery whose handoffs were recorded but not checked by AI (the safe-stop path).
 * Held handoffs are never paid from here.
 */
export async function POST(req: Request) {
  const { code, reviewer } = (await req.json()) as { code: string; reviewer?: string };
  const c = await consignmentByCode(code);
  if (!c?.schedule) return NextResponse.json({ error: "Unknown consignment or no scheduled payout" }, { status: 404 });
  const hs = await handoffsFor(code);
  const hops = new Set(hs.map((h) => h.hop));
  if (c.route.some((l) => !hops.has(l.hop))) return NextResponse.json({ error: "Not every hop has been handed over yet" }, { status: 409 });
  if (hs.some((h) => h.verdict === "held")) return NextResponse.json({ error: "A hop is held; it needs a dispute, not an approval" }, { status: 409 });
  const r = await releaseFee(c.schedule);
  const hcs = await logHandoff({ t: "daak.reviewed", code, reviewer: reviewer ?? "operator", release: r.releaseTx });
  return NextResponse.json({ released: true, payout: hashscan("transaction", r.releaseTx), hcs });
}
