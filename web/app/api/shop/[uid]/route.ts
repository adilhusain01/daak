import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { shopBalance } from "@/lib/shop";

/** A shop's prepaid balance and how to top it up by UPI. */
export async function GET(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(req) && !isOperator(req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const b = await shopBalance(uid);
  return NextResponse.json({ ...b, upiId: process.env.DAAK_UPI_ID || null, upiName: "Daak" });
}
