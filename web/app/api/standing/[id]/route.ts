import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { patchStanding, standingOrders } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";

/** Pause or resume a standing order. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isApp(req) && !isOperator(req)) return denied("app");
  const { id } = await ctx.params;
  const { active } = (await req.json()) as { active: boolean };
  const o = (await standingOrders()).find((x) => x.id === id);
  if (!o) return NextResponse.json({ error: "Unknown standing order" }, { status: 404 });
  const arkiv = await patchStanding(o.key, { active: Boolean(active) });
  await logHandoff({ t: "daak.standing.paused", id, active: Boolean(active) });
  return NextResponse.json({ ok: true, active: Boolean(active), arkiv });
}
