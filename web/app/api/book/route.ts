import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, BOOKING_PRICE } from "@/lib/x402";
import { putConsignment, type Leg } from "@/lib/arkiv";
import { lockFee, hashscan } from "@/lib/payout";
import { logHandoff } from "@/lib/hedera";

type Body = { parcel: string; label: string; feeRupees?: number; route: Leg[] };

/** The Daak meter: one published rate per booking, so a fee always matches its distance. */
const METER = { baseRupees: 5, perKmRupees: 0.5 };
const meterFee = (route: Leg[]) => METER.baseRupees + METER.perKmRupees * route.reduce((s, l) => s + (l.km ?? 0), 0);

/**
 * Books a delivery. Paid over x402 on Hedera before this runs: the sender's ordering software gets a 402,
 * pays, and retries. Then the consignment goes to Arkiv and the fee is locked in escrow with its payout scheduled.
 */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const b = (await req.json()) as Body;
  if (!b.parcel || !b.route?.length) {
    return NextResponse.json({ error: "Need parcel and route" }, { status: 400 });
  }
  b.feeRupees = Math.round(meterFee(b.route) * 100) / 100;
  const code = `KNP-${String(Date.now()).slice(-4)}`;
  const money = await lockFee(code, b.feeRupees, b.route.filter((l) => (l.km ?? 0) > 0).map((l) => ({ badge: l.from, km: l.km! })));
  const arkiv = await putConsignment({ code, parcel: b.parcel, label: b.label ?? "", route: b.route, feeRupees: b.feeRupees, schedule: money.scheduleId });
  const hcs = await logHandoff({ t: "daak.booked", code, legs: b.route.length, feeRupees: b.feeRupees, schedule: money.scheduleId });
  return NextResponse.json({
    code,
    feeRupees: b.feeRupees,
    meter: `Rs ${METER.baseRupees} + Rs ${METER.perKmRupees}/km`,
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
