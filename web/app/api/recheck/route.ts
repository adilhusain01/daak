import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { consignmentByCode, handoffsFor, writeHandoff } from "@/lib/arkiv";
import { checkParcel } from "@/lib/zg";
import { submitLog } from "@/lib/hedera";
import { downloadPhoto, openRef } from "@/lib/swarm";
import { logDecision } from "@/lib/zgstore";
import { releaseFee, hashscan } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { isSplit, payAdvance, settleDelivered } from "@/lib/split";

/**
 * The safe-stop resolving itself: handoffs recorded as "not checked by AI" (0G was down) are sent to the
 * sealed model now, using the photo saved encrypted on Swarm. A pass turns the hop green; if every hop is
 * then green, the scheduled payout releases with no person involved. A fail holds the hop.
 */
export async function POST(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const { code } = (await req.json()) as { code: string };
  const c = await consignmentByCode(code);
  if (!c) return NextResponse.json({ error: "Unknown consignment" }, { status: 404 });
  const all = await handoffsFor(code);
  const latestByHop = new Map<number, (typeof all)[number]>();
  for (const h of [...all].sort((a, b) => a.at - b.at)) latestByHop.set(h.hop, h);
  const results = [];
  for (const h of latestByHop.values()) {
    if (h.verdict !== "unchecked" || !h.photo) continue;
    const leg = c.route.find((l) => l.hop === h.hop)!;
    try {
      const photo = Buffer.from(await downloadPhoto(openRef(h.photo)));
      const check = await checkParcel(photo, code, `hop ${h.hop} at ${leg.place}`, 40000);
      const verdict = check.match && check.condition === "intact" ? "green" : "held";
      const reason = verdict === "green" ? "Rechecked by 0G after the outage: code matches, parcel intact." : `Rechecked by 0G: ${check.reason}`;
      const log = await submitLog({ t: "daak.recheck", code, hop: h.hop, verdict, zg: check.requestId ?? null, photo: h.photoSha256, was: h.key });
      const seq = await log.sequence().catch(() => "");
      const zg = await logDecision({ t: "daak.decision", code, hop: h.hop, verdict, reason, model: check.model, requestId: check.requestId, teeVerified: check.verified, recheckOf: h.key }).catch(() => null);
      const { key: _old, ...rest } = h;
      await writeHandoff({ ...rest, verdict, reason, zgRequestId: check.requestId ?? "", hcs: seq ? `${log.topicId}#${seq}` : h.hcs, at: Date.now(), zgLog: zg?.rootHash ?? "" });
      results.push({ hop: h.hop, verdict, requestId: check.requestId });
    } catch (e) {
      results.push({ hop: h.hop, verdict: "unchecked", error: (e as Error).message.slice(0, 160) });
    }
  }
  // If the recheck made every hop green, the delivery pays itself.
  const after = await handoffsFor(code);
  const latest = new Map<number, string>();
  for (const h of [...after].sort((a, b) => a.at - b.at)) latest.set(h.hop, h.verdict);
  const allGreen = c.route.every((l) => latest.get(l.hop) === "green");
  let payout: string | undefined;
  if (isSplit(c)) {
    try {
      if (allGreen) { const h = await settleDelivered(c); payout = h ? hashscan("schedule", h.schedule) : "already scheduled"; }
      else for (const r of results) if (r.verdict === "green") await payAdvance(c, r.hop);
    } catch (e) { payout = `not released: ${(e as Error).message.slice(0, 120)}`; }
  } else if (allGreen && c.schedule && results.some((r) => r.verdict === "green")) {
    try {
      const r = await releaseFee(c.schedule);
      await cashOutAll(c);
      payout = hashscan("transaction", r.releaseTx);
    } catch (e) {
      payout = `not released: ${(e as Error).message.slice(0, 120)}`;
    }
  }
  return NextResponse.json({ code, results, allGreen, payout });
}
