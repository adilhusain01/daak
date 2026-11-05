import { accountFor } from "./payout";
import { chain } from "./hedera";
import { cashOut } from "./upi";
import type { Leg } from "./arkiv";

/** The driver's dINR on chain right now, from the mirror node (waits briefly for the payout to show). */
async function balanceUnits(accountId: string, tokenId: string) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`, { cache: "no-store" });
    const units = Number((await r.json()).tokens?.[0]?.balance ?? 0);
    if (units > 0) return units;
    await new Promise((res) => setTimeout(res, 1500));
  }
  return 0;
}

/** After a delivery's payout runs, every driver's dINR (their share less the network's 2%) is redeemed and sent to UPI. */
export async function cashOutAll(c: { code: string; route: Leg[] }) {
  const { feeTokenId } = chain();
  const drivers = [...new Set(c.route.map((l) => l.from))];
  const out = [];
  for (const badge of drivers) {
    const units = await balanceUnits(await accountFor(badge), feeTokenId!);
    if (units > 0) out.push(await cashOut(c.code, badge, `Daak driver ${badge.slice(-5)}`, units));
  }
  return out;
}
