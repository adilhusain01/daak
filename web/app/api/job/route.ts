import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { consignmentByCode } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";

/** A driver accepts or declines a stretch they were booked for. The answer goes on the public log by badge hash. */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { code, uid, decision } = (await req.json()) as { code: string; uid: string; decision: "accept" | "decline" };
  if (!["accept", "decline"].includes(decision)) return NextResponse.json({ error: "Accept or decline" }, { status: 400 });
  const c = await consignmentByCode(code);
  const leg = c?.route.find((l) => l.from === uid && (l.km ?? 0) > 0);
  if (!c || !leg) return NextResponse.json({ error: "You are not a driver on this booking" }, { status: 404 });
  const hcs = await logHandoff({ t: "daak.job", code, hop: leg.hop, driver: badgeHash(uid), decision });
  return NextResponse.json({ ok: true, code, hop: leg.hop, decision, hcs });
}
