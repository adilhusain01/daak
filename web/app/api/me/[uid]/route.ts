import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge } from "@/lib/arkiv";

/** Who a tapped badge belongs to, so the app shows each person only their own actions. */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(_req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const b = await getBadge(uid).catch(() => null);
  if (!b) return NextResponse.json({ known: false }, { status: 404 });
  return NextResponse.json({ known: true, name: b.name, role: b.role, vehicle: b.vehicle });
}
