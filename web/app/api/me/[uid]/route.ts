import { denied, isApp, isOperator } from "@/lib/auth";
import { after, NextResponse } from "next/server";
import { sweep } from "@/lib/settle";
import { getBadge } from "@/lib/arkiv";

/** Who a tapped badge belongs to, so the app shows each person only their own actions. */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(_req)) return denied("app");
  const uid = decodeURIComponent((await ctx.params).uid);
  const b = await getBadge(uid).catch(() => null);
  if (!b) return NextResponse.json({ known: false }, { status: 404 });
  if (b.role === "driver") after(() => sweep(uid).catch((e) => console.error("sweep", e)));
  return NextResponse.json({ known: true, name: b.name, role: b.role, vehicle: b.vehicle });
}
