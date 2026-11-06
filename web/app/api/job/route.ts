import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { consignmentByCode } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";
import { reassign } from "@/lib/reassign";
import { getBadge } from "@/lib/arkiv";
import { checkSignedAction } from "@/lib/signing";

/** A driver accepts or declines a stretch they were booked for, signed by their phone. The answer goes on the public log by badge hash. */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { code, uid, decision, at, sig } = (await req.json()) as { code: string; uid: string; decision: "accept" | "decline"; at?: number; sig?: string };
  if (!["accept", "decline"].includes(decision)) return NextResponse.json({ error: "Accept or decline" }, { status: 400 });
  // Only the driver's own registered phone can answer for them.
  const b = await getBadge(uid).catch(() => null);
  if (!checkSignedAction({ devicePub: b?.devicePub, message: `daak.job|${code}|${uid}|${decision}|${at}`, at: Number(at), sig, now: Date.now() })) {
    return NextResponse.json({ error: "This answer did not come from your registered phone." }, { status: 401 });
  }
  const c = await consignmentByCode(code);
  const leg = c?.route.find((l) => l.from === uid && (l.km ?? 0) > 0);
  if (!c || !leg) return NextResponse.json({ error: "You are not a driver on this booking" }, { status: 404 });
  const hcs = await logHandoff({ t: "daak.job", code, hop: leg.hop, driver: badgeHash(uid), decision });
  // A decline goes straight to the next driver whose bus connects.
  const reassigned = decision === "decline" ? await reassign(c, leg.hop).catch((e) => ({ error: (e as Error).message })) : undefined;
  return NextResponse.json({ ok: true, code, hop: leg.hop, decision, hcs, reassigned });
}
