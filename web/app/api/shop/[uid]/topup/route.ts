import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hashscan } from "@/lib/payout";
import { topUpShop } from "@/lib/shop";

/** The operator saw the shop's UPI payment: credit the same rupees to the shop's agent, with the UTR on the log. */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isOperator(req)) return denied("operator");
  const uid = decodeURIComponent((await ctx.params).uid);
  const { rupees, utr } = (await req.json()) as { rupees: number; utr: string };
  try {
    const r = await topUpShop(uid, Number(rupees), String(utr ?? "").trim());
    return NextResponse.json({ ok: true, ...r, proof: hashscan("transaction", r.tx) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
