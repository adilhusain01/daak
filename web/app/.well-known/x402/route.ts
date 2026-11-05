import { NextResponse } from "next/server";
import { WEIGHT_BANDS, METER, BOOKING_FEE } from "@/lib/network";
import { settlementAsset, settlesInRupees, X402_ASSET } from "@/lib/x402";

/**
 * Daak's x402 catalogue: what an agent can buy here, where, and how it is priced. A shop's agent reads this
 * first and then calls the booking endpoint, which answers 402 with the exact price of that booking.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    x402Version: 2,
    name: "Daak",
    description: "Relay delivery on UP and Bihar bus routes, with every handoff proven and every driver paid by the kilometre.",
    resources: [{
      id: "daak.book",
      resource: `${origin}/api/book`,
      method: "POST",
      network: "hedera:testnet",
      scheme: "exact",
      asset: settlesInRupees() ? settlementAsset() : X402_ASSET,
      assetName: settlesInRupees() ? "dINR (Daak Rupee, 2 decimals)" : undefined,
      payTo: process.env.HEDERA_OPERATOR_ID ?? "",
      pricing: settlesInRupees()
        ? `Rs ${METER.baseRupees} + Rs ${METER.perKmRupees} a km, times the weight band (${WEIGHT_BANDS.map((b) => `${b.label} x${b.factor}`).join(", ")}), plus a ${BOOKING_FEE.percent}% booking fee (at least Rs ${BOOKING_FEE.minRupees}). The 402 quotes the exact amount.`
        : "Flat price per booking; the 402 quotes it.",
      input: {
        parcel: "the parcel's NFC serial",
        label: "what is in it",
        route: "legs { hop, from, to, place, km } from GET /api/routes or the app's plan",
        weight: "s | m | l | xl",
      },
    }],
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
