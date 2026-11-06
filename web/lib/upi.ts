import { TransferTransaction } from "@hiero-ledger/sdk";
import { accountFor, keyFor } from "./payout";
import { chain, hedera, logHandoff } from "./hedera";
import { env } from "./env";

/**
 * Drivers are paid in rupees on UPI. The chain stays the record of who earned what; this file is the exit:
 * the driver's dINR goes back to Daak's treasury (redeemed one for one), and the same rupees go to their UPI ID
 * through RazorpayX Payouts. Both references land on the public HCS log, side by side.
 */
const RZP = "https://api.razorpay.com/v1";
const auth = () => "Basic " + Buffer.from(`${process.env.RAZORPAY_API_KEY}:${process.env.RAZORPAY_SECRET}`).toString("base64");

async function rzp(path: string, body?: object, idem?: string) {
  const r = await fetch(`${RZP}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: auth(), "Content-Type": "application/json", ...(idem ? { "X-Payout-Idempotency": idem } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.description ?? `Razorpay ${r.status}`);
  return j;
}

/** Contact plus UPI fund account for a driver. In test mode the UPI ID is Razorpay's success@razorpay. */
async function fundAccount(badge: string, name: string, vpa: string) {
  const contact = await rzp("/contacts", { name, type: "vendor", reference_id: `daak-${badge.replace(/:/g, "").slice(-12)}` });
  const fa = await rzp("/fund_accounts", { contact_id: contact.id, account_type: "vpa", vpa: { address: vpa } });
  return fa.id as string;
}

export const upiReady = () => Boolean(process.env.RAZORPAY_API_KEY && process.env.RAZORPAY_SECRET && process.env.RAZORPAYX_ACCOUNT_NUMBER);

/** Redeems a driver's dINR and pays the same rupees to their UPI ID. Idempotent per consignment and driver. */
export async function cashOut(code: string, badge: string, name: string, units: number, vpa = "success@razorpay") {
  const { feeTokenId } = chain();
  const driverId = await accountFor(badge);
  const redeem = await new TransferTransaction()
    .addTokenTransfer(feeTokenId!, driverId, -units)
    .addTokenTransfer(feeTokenId!, env.hederaOperatorId(), units)
    .setTransactionMemo(`Daak ${code} redeem to UPI`)
    .freezeWith(hedera())
    .sign(keyFor(badge));
  const res = await redeem.execute(hedera());
  await res.getReceipt(hedera());
  const redeemTx = res.transactionId.toString();

  let upi: { status: string; id?: string; utr?: string | null; error?: string } = { status: "not_connected" };
  if (upiReady()) {
    try {
      const fa = await fundAccount(badge, name, vpa);
      const p = await rzp("/payouts", {
        account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER, fund_account_id: fa, amount: units, currency: "INR",
        mode: "UPI", purpose: "payout", queue_if_low_balance: true, reference_id: redeemTx.replace(/[^0-9A-Za-z]/g, "").slice(-40),
        narration: `Daak ${code}`.slice(0, 30),
      }, redeemTx);
      upi = { status: p.status, id: p.id, utr: p.utr ?? null };
    } catch (e) {
      upi = { status: "failed", error: (e as Error).message.slice(0, 160) };
    }
  }
  const hcs = await logHandoff({ t: "daak.cashout", code, driver: driverId, rupees: units / 100, redeem: redeemTx, upi: upi.id ?? null, utr: upi.utr ?? null, status: upi.status });
  return { driverId, rupees: units / 100, redeemTx, upi, hcs };
}
