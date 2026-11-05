import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import { accountFor, keyFor } from "./payout";
import { hedera } from "./hedera";
import { env } from "./env";
import type { Leg } from "./arkiv";

/**
 * The sender's ordering agent. It has its own Hedera account and pays for bookings over x402,
 * within spending controls: HBAR only, at most 2 HBAR a booking, and only ever to Daak.
 */
export async function agentBook(baseUrl: string, body: { parcel: string; label: string; feeRupees: number; route: Leg[] }) {
  const agentId = await accountFor("sender-agent");
  const bal = await (await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${agentId}`, { cache: "no-store" })).json();
  if (bal.balance.balance < 3e8) {
    const top = await new TransferTransaction()
      .addHbarTransfer(env.hederaOperatorId(), new Hbar(-5)).addHbarTransfer(agentId, new Hbar(5))
      .setTransactionMemo("Daak: top up the sender agent").execute(hedera());
    await top.getReceipt(hedera());
  }
  const signer = createClientHederaSigner(agentId, keyFor("sender-agent"), { network: "hedera:testnet" });
  const pay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "hedera:testnet", client: new ExactHederaScheme(signer) }],
    spendControls: { allowedAssets: [{ network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: String(2 * 100_000_000) }] },
    policies: [(_v, reqs) => reqs.filter((r) => r.payTo === env.hederaOperatorId())],
  });
  const res = await pay(`${baseUrl}/api/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`booking ${res.status}: ${text.slice(0, 200)}`);
  return { ...JSON.parse(text), paidBy: agentId, x402: res.headers.get("payment-response") ? "settled" : "unknown" };
}
