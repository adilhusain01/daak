import { accountFor, keyFor } from "./payout";
import { TransferTransaction } from "@hiero-ledger/sdk";
import { chain, hedera, logHandoff } from "./hedera";
import { getPrefs, getBadge } from "./arkiv";
import { unseal } from "./swarm";
import { env } from "./env";
import { cashOut } from "./upi";
import { bachatUnits } from "./rules";
import type { Leg } from "./arkiv";

/** The driver's dINR on chain right now, from the mirror node (waits briefly for the payout to show). */
async function balanceUnits(accountId: string, tokenId: string, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`, { cache: "no-store" });
    const units = Number((await r.json()).tokens?.[0]?.balance ?? 0);
    if (units > 0) return units;
    await new Promise((res) => setTimeout(res, 1500));
  }
  return 0;
}

/**
 * After a payout lands, each driver's dINR (their share less the network's 2%) is redeemed and sent to UPI.
 * `only` limits it to the drivers just paid (an advance pays one driver, not the whole route).
 */
export async function cashOutAll(c: { code: string; route: Leg[] }, only?: string[]) {
  const { feeTokenId } = chain();
  const drivers = [...new Set(c.route.filter((l) => (l.km ?? 0) > 0).map((l) => l.from))].filter((b) => !only || only.includes(b));
  const out = [];
  for (const badge of drivers) {
    const driverId = await accountFor(badge);
    const units = await balanceUnits(driverId, feeTokenId!);
    if (units <= 0) continue;
    // Bachat: the share the driver chose goes to their locked pot first; the rest goes to UPI.
    const { savePercent } = await getPrefs(badge).catch(() => ({ savePercent: 0 }));
    const save = bachatUnits(units, savePercent);
    let bachat = null;
    if (save > 0) {
      const potId = await accountFor(`bachat:${badge}`);
      // Savings must not pay Daak's 2%: the driver's share goes to the treasury (the fee lands back in the
      // treasury, so it nets to zero) and the treasury, which the fee exempts, moves the full amount to the pot.
      const toTreasury = await new TransferTransaction()
        .addTokenTransfer(feeTokenId!, driverId, -save).addTokenTransfer(feeTokenId!, env.hederaOperatorId(), save)
        .setTransactionMemo(`Daak ${c.code} Bachat ${savePercent}% in`)
        .freezeWith(hedera()).sign(keyFor(badge));
      await (await toTreasury.execute(hedera())).getReceipt(hedera());
      const res = await new TransferTransaction()
        .addTokenTransfer(feeTokenId!, env.hederaOperatorId(), -save).addTokenTransfer(feeTokenId!, potId, save)
        .setTransactionMemo(`Daak ${c.code} Bachat ${savePercent}% to pot`)
        .execute(hedera());
      await res.getReceipt(hedera());
      const potUnits = await balanceUnits(potId, feeTokenId!);
      const hcs = await logHandoff({ t: "daak.bachat", code: c.code, driver: driverId, pot: potId, saved: save / 100, potRupees: potUnits / 100, tx: res.transactionId.toString() });
      bachat = { potId, savedRupees: save / 100, potRupees: potUnits / 100, hcs };
    }
    // Pay to the UPI ID the driver gave when they joined (sealed on Arkiv); Razorpay's test ID otherwise.
    const who = await getBadge(badge).catch(() => null);
    let vpa = "success@razorpay";
    try { if (who?.private) vpa = JSON.parse(unseal(who.private, "person")).upi || vpa; } catch { /* keep the test ID */ }
    out.push({ ...(await cashOut(c.code, badge, who?.name ?? `Daak driver ${badge.slice(-5)}`, units - save, vpa)), bachat });
  }
  return out;
}

/**
 * Holdbacks release on chain by themselves, with no server watching. When a driver next opens the app,
 * whatever dINR is sitting in their account goes on to UPI (and Bachat) the same way as any payout.
 */
export async function sweep(badge: string) {
  const { feeTokenId } = chain();
  if ((await balanceUnits(await accountFor(badge), feeTokenId!, 1)) <= 0) return [];
  return cashOutAll({ code: "holdback", route: [{ hop: 1, from: badge, to: "", place: "", km: 1 }] });
}
