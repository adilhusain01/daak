import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import { accountFor, keyFor } from "./payout";
import { chain, hedera } from "./hedera";
import { bookingTotal, settlesInRupees } from "./x402";
import { shopAgentLabel, shopBalance } from "./shop";
import { env } from "./env";
import type { Leg } from "./arkiv";

/**
 * A shop's ordering agent. It has its own Hedera account holding the shop's prepaid rupees (dINR), finds Daak's
 * booking endpoint from the catalogue at /.well-known/x402, and pays each booking over x402 with no person in
 * the loop, within spending controls: only dINR, at most Rs 2,000 a booking, and only ever to Daak.
 * With X402_ASSET set to HBAR or USDC instead, one shared agent pays a flat price (the earlier mode).
 */
export async function agentBook(baseUrl: string, body: { parcel: string; label: string; feeRupees?: number; route: Leg[]; weight?: string }, shop?: string) {
  // Discovery: the agent reads Daak's catalogue rather than knowing the URL in advance.
  const catalogue = await (await fetch(`${baseUrl}/.well-known/x402`, { cache: "no-store" })).json().catch(() => null);
  const offer = catalogue?.resources?.find((r: { id: string }) => r.id === "daak.book");
  const endpoint: string = offer?.resource ?? `${baseUrl}/api/book`;

  const inRupees = settlesInRupees() && Boolean(shop);
  const label = inRupees ? shopAgentLabel(shop!) : "sender-agent";
  const agentId = await accountFor(label);
  if (inRupees) {
    const { total } = bookingTotal(body.route, body.weight);
    const { rupees } = await shopBalance(shop!);
    if (rupees < total) throw new Error(`Balance Rs ${rupees.toFixed(2)}, booking Rs ${total.toFixed(2)}: top up Rs ${Math.ceil(total - rupees)} by UPI`);
  } else {
    await floatForSharedAgent(agentId);
  }
  const signer = createClientHederaSigner(agentId, keyFor(label), { network: "hedera:testnet" });
  const dinr = chain().feeTokenId!;
  const pay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "hedera:testnet", client: new ExactHederaScheme(signer) }],
    spendControls: {
      maxAmountPerPayment: "$3",
      allowedAssets: [
        { network: "hedera:testnet", asset: dinr, maxAmountPerPayment: String(2000 * 100) },
        { network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: String(2 * 100_000_000) },
        { network: "hedera:testnet", asset: "0.0.429274", maxAmountPerPayment: "3000000" },
      ],
    },
    policies: [(_v, reqs) => reqs.filter((r) => r.payTo === env.hederaOperatorId())],
  });
  const res = await pay(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`booking ${res.status}: ${text.slice(0, 200)}`);
  return { ...JSON.parse(text), paidBy: agentId, x402: res.headers.get("payment-response") ? "settled" : "unknown", endpoint };
}

/** The shared agent of the flat-price mode keeps a small float of HBAR, and USDC when settling in USDC. */
async function floatForSharedAgent(agentId: string) {
  const bal = await (await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${agentId}`, { cache: "no-store" })).json();
  if (process.env.X402_ASSET === "0.0.429274") {
    const usdc = (bal.balance.tokens ?? []).find((t: { token_id: string }) => t.token_id === "0.0.429274")?.balance ?? 0;
    if (usdc < 3_000_000) {
      const top = await new TransferTransaction()
        .addTokenTransfer("0.0.429274", env.hederaOperatorId(), -10_000_000).addTokenTransfer("0.0.429274", agentId, 10_000_000)
        .setTransactionMemo("Daak: USDC float for the sender agent").execute(hedera());
      await top.getReceipt(hedera());
    }
  }
  if (bal.balance.balance < 3e8) {
    const top = await new TransferTransaction()
      .addHbarTransfer(env.hederaOperatorId(), new Hbar(-5)).addHbarTransfer(agentId, new Hbar(5))
      .setTransactionMemo("Daak: top up the sender agent").execute(hedera());
    await top.getReceipt(hedera());
  }
}
