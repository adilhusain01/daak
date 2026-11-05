import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, BOOKING_PRICE } from "@/lib/x402";
import { putConsignment, type Leg } from "@/lib/arkiv";
import { lockFee, hashscan } from "@/lib/payout";
import { logHandoff } from "@/lib/hedera";

type Body = { parcel: string; label: string; feeRupees: number; route: Leg[] };

/**
 * Books a delivery. Paid over x402 on Hedera before this runs: the sender's ordering software gets a 402,
 * pays, and retries. Then the consignment goes to Arkiv and the fee is locked in escrow with its payout scheduled.
 */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const b = (await req.json()) as Body;
  if (!b.parcel || !b.route?.length || !b.feeRupees) {
    return NextResponse.json({ error: "Need parcel, route and feeRupees" }, { status: 400 });
  }
  const code = `KNP-${String(Date.now()).slice(-4)}`;
  const arkiv = await putConsignment({ code, parcel: b.parcel, label: b.label ?? "", route: b.route, feeRupees: b.feeRupees });
  const money = await lockFee(code, b.feeRupees, b.route.map((l) => ({ badge: l.from, km: l.km ?? 1 })));
  const hcs = await logHandoff({ t: "daak.booked", code, legs: b.route.length, feeRupees: b.feeRupees, schedule: money.scheduleId });
  return NextResponse.json({
    code,
    shares: money.shares.map((s) => ({ km: s.km, rupees: s.units / 100 })),
    proofs: {
      arkiv,
      lock: hashscan("transaction", money.lockTx),
      schedule: hashscan("schedule", money.scheduleId),
      hcs,
    },
  });
}

export const POST = withX402(
  handler,
  {
    accepts: [{ scheme: "exact", price: BOOKING_PRICE, network: "hedera:testnet", payTo: process.env.HEDERA_OPERATOR_ID ?? "" }],
    description: "Book a Daak relay delivery",
  },
  x402Server,
);
