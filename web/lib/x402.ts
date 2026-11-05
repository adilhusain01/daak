import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/next";
import { ExactHederaScheme } from "@x402/hedera/exact/server";

/** x402 on Hedera testnet through the official facilitator, which pays the network fee. */
export const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export const x402Server = new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl })).register(
  "hedera:testnet",
  new ExactHederaScheme({ defaultAssets: { "hedera:testnet": { asset: "0.0.429274", decimals: 6 } } }),
);

/**
 * What a booking costs over x402. Default: 1 HBAR (tinybars). Set X402_ASSET=0.0.429274 (Circle's testnet USDC)
 * and X402_AMOUNT in micro-USDC (2150000 = USD 2.15, about the Rs 180 meter fee) to settle in a stablecoin.
 */
export const X402_ASSET = process.env.X402_ASSET ?? "0.0.0";
export const BOOKING_PRICE = { asset: X402_ASSET, amount: process.env.X402_AMOUNT ?? (X402_ASSET === "0.0.0" ? String(1 * 100_000_000) : "2150000") };
