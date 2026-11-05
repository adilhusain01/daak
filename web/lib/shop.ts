import { TransferTransaction } from "@hiero-ledger/sdk";
import { env } from "./env";
import { chain, hedera, logHandoff } from "./hedera";
import { badgeHash } from "./history";
import { accountFor } from "./payout";

/**
 * Each shop has its own agent account on Hedera holding the shop's prepaid rupees (dINR). The shop tops it up
 * by UPI to Daak; once the operator sees the payment, the treasury credits the same rupees to the agent, and
 * the bank reference (UTR) goes on the public log. The agent pays every booking from this balance over x402.
 */
export const shopAgentLabel = (sender: string) => `agent:${sender}`;
export const shopAgent = (sender: string) => accountFor(shopAgentLabel(sender));

export async function shopBalance(sender: string) {
  const { feeTokenId } = chain();
  const id = await shopAgent(sender);
  const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${id}/tokens?token.id=${feeTokenId}`, { cache: "no-store" });
  const units = r.ok ? Number((await r.json()).tokens?.[0]?.balance ?? 0) : 0;
  return { account: id, rupees: units / 100 };
}

/** The operator confirms a shop's UPI payment: the treasury credits the shop's agent with the same rupees. */
export async function topUpShop(sender: string, rupees: number, utr: string) {
  if (!(rupees > 0 && rupees <= 50_000)) throw new Error("Top up between Rs 1 and Rs 50,000");
  if (!/^[A-Za-z0-9]{6,22}$/.test(utr)) throw new Error("Enter the UPI reference (UTR) of the payment");
  const { feeTokenId } = chain();
  const agent = await shopAgent(sender);
  const units = Math.round(rupees * 100);
  const res = await new TransferTransaction()
    .addTokenTransfer(feeTokenId!, env.hederaOperatorId(), -units).addTokenTransfer(feeTokenId!, agent, units)
    .setTransactionMemo(`Daak shop top-up by UPI ${utr}`).execute(hedera());
  await res.getReceipt(hedera());
  const tx = res.transactionId.toString();
  const hcs = await logHandoff({ t: "daak.topup", shop: badgeHash(sender), rupees, utr, tx });
  return { agent, rupees, tx, hcs };
}
