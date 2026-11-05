import { NextResponse } from "next/server";
import { ScheduleDeleteTransaction, ScheduleId, TransferTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { consignmentByCode } from "@/lib/arkiv";
import { releaseFee, keyFor, hashscan, toUnits } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { chain, hedera, submitLog } from "@/lib/hedera";
import { env } from "@/lib/env";

/**
 * The operator settles a disputed delivery. "pay": the drivers are paid anyway (the photo shows it was fine).
 * "refund": the scheduled payout is cancelled and the escrowed fee returns to Daak to refund the shop.
 * Either way the decision and who made it go on the public log.
 */
export async function POST(req: Request) {
  const { code, action, reviewer, note } = (await req.json()) as { code: string; action: "pay" | "refund"; reviewer?: string; note?: string };
  const c = await consignmentByCode(code);
  if (!c?.schedule) return NextResponse.json({ error: "Unknown consignment" }, { status: 404 });
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
