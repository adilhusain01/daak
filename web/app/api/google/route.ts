import { NextResponse } from "next/server";
import { denied, isApp } from "@/lib/auth";
import { getBadge } from "@/lib/arkiv";
import { verifyGoogle } from "@/lib/google";

/**
 * "Continue with Google" from the app: no sticker needed. A known account signs straight in; a new one goes on to
 * the join form with its name filled in. The email is never returned or stored in the open.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "Missing Google token" }, { status: 400 });
  const g = await verifyGoogle(idToken).catch((e: Error) => { console.error("google", e.message); return null; });
  if (!g) return NextResponse.json({ error: "Google could not confirm this account. Try again." }, { status: 401 });
  const b = await getBadge(g.uid).catch(() => null);
  return NextResponse.json({ uid: g.uid, known: Boolean(b), name: b?.name ?? g.name, role: b?.role ?? null, vehicle: b?.vehicle ?? null });
}
