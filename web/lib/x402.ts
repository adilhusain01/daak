import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/next";
import { ExactHederaScheme } from "@x402/hedera/exact/server";

/** x402 on Hedera testnet through the official facilitator, which pays the network fee. */
export const facilitatorUrl = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export const x402Server = new x402ResourceServer(new HTTPFacilitatorClient({ url: facilitatorUrl })).register(
  "hedera:testnet",
  new ExactHederaScheme({ defaultAssets: { "hedera:testnet": { asset: "0.0.429274", decimals: 6 } } }),
);

/** A booking costs 1 HBAR on testnet; the sender's software pays it with no human in the loop. */
export const BOOKING_PRICE = { asset: "0.0.0", amount: String(1 * 100_000_000) };
