import { band, bookingFee, meterFee } from "@/lib/network";
import { readLog, workHistory } from "@/lib/history";
import { fundPool, legPay } from "@/lib/split";
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, bookingPrice, routeKm } from "@/lib/x402";
import { putConsignment, getBadge, type Leg } from "@/lib/arkiv";
import { lockFee, hashscan, accountFor } from "@/lib/payout";
import { shopAgentData, verifyUaid } from "@/lib/uaid";
import { shopAgentLabel } from "@/lib/shop";
import { badgeHash } from "@/lib/history";
import { logHandoff } from "@/lib/hedera";

type Body = { parcel: string; label: string; feeRupees?: number; route: Leg[]; weight?: string };


/**
 * Books a delivery. Paid over x402 on Hedera before this runs: the shop's agent gets a 402 quoting the exact
 * booking, pays it from the shop's rupee balance, and retries. Then the consignment goes to Arkiv and the
 * drivers' meter is locked in escrow; the booking fee stays with Daak.
 */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const b = (await req.json()) as Body;
  if (!b.parcel || !b.route?.length) {
    return NextResponse.json({ error: "Need parcel and route" }, { status: 400 });
  }
  let weight;
  try { weight = band(b.weight ?? "s"); } catch { return NextResponse.json({ error: "Unknown weight band" }, { status: 400 }); }
  let km;
  try { km = routeKm(b.route); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  b.feeRupees = meterFee(km, weight.id);
  // Only people who have joined Daak can be on a route: no accounts are created for made-up badges.
  const people = [...new Set(b.route.flatMap((l) => [l.from, l.to]))];
  const known = await Promise.all(people.map((u) => getBadge(u).catch(() => null)));
  if (known.some((k) => !k)) return NextResponse.json({ error: "Everyone on the route must join Daak first" }, { status: 400 });
  const code = `KNP-${String(Date.now()).slice(-4)}`;
  // Each driver's share of pay at handover is fixed now, from their public record on the log.
  const log = await readLog().catch(() => []);
  for (const l of b.route) {
    if ((l.km ?? 0) > 0) l.advancePct = (await workHistory(l.from, log).catch(() => null))?.tier.advancePct ?? 50;
  }
  // The record goes first: if it fails, no money has moved yet.
  const arkiv = await putConsignment({ code, parcel: b.parcel, label: b.label ?? "", route: b.route, feeRupees: b.feeRupees, weight: weight.id });
  const money = await lockFee(code, b.feeRupees, b.route.filter((l) => (l.km ?? 0) > 0).map((l) => ({ badge: l.from, km: l.km! })));
  const pool = await fundPool(code, b.feeRupees).catch((e) => { console.error("pool", e); return null; });
  const shares = legPay({ code, feeRupees: b.feeRupees, route: b.route });
  // HCS-14: the paying agent's identity, recomputed from the shop on the route and its agent account.
  const claimed = req.headers.get("x-agent-uaid");
  let agentUaid: string | null = null;
  if (claimed) {
    const shop = b.route[0]?.from ?? "";
    const account = await accountFor(shopAgentLabel(shop));
    agentUaid = verifyUaid(claimed, shopAgentData(badgeHash(shop), account), account) ? claimed : null;
  }
  const hcs = await logHandoff({
    t: "daak.booked", code, legs: b.route.length, weight: weight.id, feeRupees: b.feeRupees, bookingFeeRupees: bookingFee(b.feeRupees),
    split: shares.map((s) => ({ hop: s.hop, pct: s.pct })), poolRupees: pool?.rupees ?? 0, agent: agentUaid,
  });
  return NextResponse.json({
    code,
    feeRupees: b.feeRupees,
    bookingFeeRupees: bookingFee(b.feeRupees),
    meter: `Rs 5 + Rs 0.50/km, ${weight.label} (x${weight.factor})`,
    weight: weight.label,
    agentUaid,
    shares: shares.map((s) => ({ hop: s.hop, km: s.km, rupees: s.units / 100, atHandoverPct: s.pct, atHandoverRupees: s.advance / 100, atDeliveryRupees: s.holdback / 100 })),
    proofs: { arkiv, lock: hashscan("transaction", money.lockTx), pool: pool && hashscan("transaction", pool.tx), hcs },
  });
}

export const POST = withX402(
  handler,
  {
    // The price is the booking itself: meter for the distance and weight plus the booking fee, in rupee credits.
    accepts: [{ scheme: "exact", price: bookingPrice, network: "hedera:testnet", payTo: process.env.HEDERA_OPERATOR_ID ?? "" }],
    description: "Book a Daak relay delivery",
  },
  x402Server,
);
