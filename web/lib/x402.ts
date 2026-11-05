import { HTTPFacilitatorClient } from "@x402/core/server";
import type { HTTPRequestContext } from "@x402/core/http";
import { x402ResourceServer } from "@x402/next";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { chain } from "./hedera";
import { band, bookingFee, meterFee, network } from "./network";
import type { Leg } from "./arkiv";

/** x402 on Hedera testnet through the official facilitator, which pays the network fee. */
export const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export const x402Server = new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl })).register(
  "hedera:testnet",
  new ExactHederaScheme({ defaultAssets: { "hedera:testnet": { asset: "0.0.429274", decimals: 6 } } }),
);

/**
 * What a booking is settled in. By default dINR, Daak's rupee-credit HTS token: a shop's agent holds the rupees
 * the shop topped up by UPI and pays the exact booking (meter plus booking fee) from them. X402_ASSET=0.0.0 (HBAR)
 * or 0.0.429274 (Circle's testnet USDC) switch to a flat price in that asset, set by X402_AMOUNT.
 */
export const X402_ASSET = process.env.X402_ASSET || "dinr";
export const settlesInRupees = () => X402_ASSET === "dinr";
export const settlementAsset = () => (settlesInRupees() ? chain().feeTokenId! : X402_ASSET);

/** The km of a route, refusing a carrying stretch whose distance is not one Daak publishes. */
export function routeKm(route: Leg[]) {
  const published = new Set(network().legs.map((l) => l.km));
  for (const l of route) if ((l.km ?? 0) > 0 && !published.has(l.km!)) throw new Error(`No published stretch is ${l.km} km`);
  return route.reduce((s, l) => s + (l.km ?? 0), 0);
}

/** The whole booking in rupees: the drivers' meter for the distance and weight, plus Daak's booking fee. */
export function bookingTotal(route: Leg[], weight = "s") {
  const meter = meterFee(routeKm(route), band(weight).id);
  return { meter, bookingFee: bookingFee(meter), total: Math.round((meter + bookingFee(meter)) * 100) / 100 };
}

/** The x402 price, computed per request from the booking in its body. */
export async function bookingPrice(ctx: HTTPRequestContext) {
  if (!settlesInRupees()) return { asset: X402_ASSET, amount: process.env.X402_AMOUNT ?? (X402_ASSET === "0.0.0" ? String(1 * 100_000_000) : "2150000") };
  const body = (await ctx.adapter.getBody?.()) as { route?: Leg[]; weight?: string } | undefined;
  const { total } = bookingTotal(body?.route ?? [], body?.weight);
  return { asset: settlementAsset(), amount: String(Math.round(total * 100)), extra: { decimals: 2, name: "Daak Rupee" } };
}
