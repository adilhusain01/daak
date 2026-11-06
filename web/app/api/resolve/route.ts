import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { ScheduleDeleteTransaction, ScheduleId, TransferTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { consignmentByCode } from "@/lib/arkiv";
import { releaseFee, keyFor, hashscan, toUnits } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { chain, hedera, submitLog } from "@/lib/hedera";
import { env } from "@/lib/env";
import { isSplit, refundLiable, settleDelivered, settledAlready } from "@/lib/split";
import { readLog } from "@/lib/history";
import { handoffsFor } from "@/lib/arkiv";

/**
 * The operator settles a disputed delivery. "pay": the drivers are paid anyway (the photo shows it was fine).
 * "refund": the scheduled payout is cancelled and the escrowed fee returns to Daak to refund the shop.
 * Either way the decision and who made it go on the public log.
 */
export async function POST(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const { code, action, reviewer, note, hop, valueRupees } = (await req.json()) as { code: string; action: "pay" | "refund"; reviewer?: string; note?: string; hop?: number; valueRupees?: number };
  const c = await consignmentByCode(code);
  if (!c) return NextResponse.json({ error: "Unknown consignment" }, { status: 404 });
  if (settledAlready(code, await readLog())) return NextResponse.json({ error: "This delivery was already settled" }, { status: 409 });
  if (isSplit(c)) {
    if (action === "pay") {
      const holdback = await settleDelivered(c);
      const log = await submitLog({ t: "daak.resolved", code, action, reviewer: reviewer ?? "operator", note: note ?? null });
      return NextResponse.json({ ok: true, action, holdback: holdback && hashscan("schedule", holdback.schedule), hcs: log.txId });
    }
    // The liable leg: the one the reviewer names, else the first held handover, else the last carrying leg.
    const hs = await handoffsFor(code);
    const held = hs.filter((h) => h.verdict === "held").sort((a, b) => a.hop - b.hop)[0]?.hop;
    const lastCarry = [...c.route].filter((l) => (l.km ?? 0) > 0).at(-1)?.hop ?? c.route.at(-1)!.hop;
    const liable = hop ?? held ?? lastCarry;
    const r = await refundLiable(c, liable, Number(valueRupees ?? 0));
    const log = await submitLog({ t: "daak.refunded", code, reviewer: reviewer ?? "operator", note: note ?? null, liableHop: liable, rupees: r.refundRupees, poolRupees: r.poolRupees, tx: r.refundTx ?? null });
    return NextResponse.json({ ok: true, action, ...r, refund: r.refundTx && hashscan("transaction", r.refundTx), hcs: log.txId });
  }
  if (!c.schedule) return NextResponse.json({ error: "No scheduled payout" }, { status: 404 });
  if (action === "pay") {
    const r = await releaseFee(c.schedule);
    await cashOutAll(c).catch(() => null);
    const log = await submitLog({ t: "daak.resolved", code, action, reviewer: reviewer ?? "operator", note: note ?? null, release: r.releaseTx });
    return NextResponse.json({ ok: true, action, payout: hashscan("transaction", r.releaseTx), hcs: log.txId });
  }
  const opKey = PrivateKey.fromStringECDSA(env.hederaOperatorKey());
  const del = await new ScheduleDeleteTransaction().setScheduleId(ScheduleId.fromString(c.schedule)).freezeWith(hedera()).sign(opKey);
  await (await del.execute(hedera())).getReceipt(hedera());
  const { feeTokenId, escrowId } = chain();
  const units = toUnits(c.feeRupees);
  const back = await new TransferTransaction()
    .addTokenTransfer(feeTokenId!, escrowId!, -units).addTokenTransfer(feeTokenId!, env.hederaOperatorId(), units)
    .setTransactionMemo(`Daak ${code} refund`).freezeWith(hedera()).sign(keyFor("escrow"));
  const res = await back.execute(hedera());
  await res.getReceipt(hedera());
  const log = await submitLog({ t: "daak.refunded", code, reviewer: reviewer ?? "operator", note: note ?? null, rupees: c.feeRupees, tx: res.transactionId.toString() });
  return NextResponse.json({ ok: true, action, refund: hashscan("transaction", res.transactionId.toString()), hcs: log.txId });
}
