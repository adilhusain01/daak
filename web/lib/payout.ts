import { createHash } from "node:crypto";
import {
  AccountCreateTransaction, AccountId, CustomFractionalFee, FeeAssessmentMethod, Hbar, PrivateKey,
  ScheduleCreateTransaction, ScheduleSignTransaction, TokenCreateTransaction, TokenSupplyType, TokenType,
  TransferTransaction, ScheduleId,
} from "@hiero-ledger/sdk";
import { env } from "./env";
import { chain, hedera, saveChain } from "./hedera";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
export const PLATFORM_FEE_PERCENT = 2;
/** dINR has 2 decimals: 1 rupee = 100 units. */
export const toUnits = (rupees: number) => Math.round(rupees * 100);

/** Every server-held key comes from one master secret, so no key store is needed. */
export function keyFor(label: string): PrivateKey {
  const seed = createHash("sha256").update(`${env.masterSecret()}:${label}`).digest();
  return PrivateKey.fromBytesECDSA(seed);
}
const operatorKey = () => PrivateKey.fromStringECDSA(env.hederaOperatorKey());

const known = new Map<string, string>();

/** The Hedera account behind a badge (or "escrow"), created on first use. Users never see it. */
export async function accountFor(label: string): Promise<string> {
  const hit = known.get(label);
  if (hit) return hit;
  const key = keyFor(label);
  const evm = key.publicKey.toEvmAddress();
  const r = await fetch(`${MIRROR}/accounts/0x${evm}`);
  if (r.ok) {
    const id = (await r.json()).account as string;
    known.set(label, id);
    return id;
  }
  const tx = await new AccountCreateTransaction()
    .setECDSAKeyWithAlias(key)
    .setInitialBalance(new Hbar(1))
    .setMaxAutomaticTokenAssociations(-1)
    .execute(hedera());
  const id = (await tx.getReceipt(hedera())).accountId!.toString();
  known.set(label, id);
  return id;
}

/** Creates the escrow account and the dINR token with the platform's 2% fee built in. Idempotent. */
export async function setupMoney() {
  const c = chain();
  if (!c.escrowId) {
    c.escrowId = await accountFor("escrow");
    saveChain(c);
  }
  if (!c.feeTokenId) {
    const fee = new CustomFractionalFee()
      .setNumerator(PLATFORM_FEE_PERCENT).setDenominator(100)
      .setFeeCollectorAccountId(env.hederaOperatorId())
      .setAssessmentMethod(FeeAssessmentMethod.Inclusive);
    const tx = await new TokenCreateTransaction()
      .setTokenName("Daak Rupee").setTokenSymbol("dINR").setDecimals(2)
      .setInitialSupply(toUnits(10_000_000)).setTreasuryAccountId(env.hederaOperatorId())
      .setTokenType(TokenType.FungibleCommon).setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(operatorKey().publicKey).setAdminKey(operatorKey().publicKey)
      .setFeeScheduleKey(operatorKey().publicKey)
      .setCustomFees([fee]).setTokenMemo("Daak delivery fees, rupee credits")
      .freezeWith(hedera()).sign(operatorKey());
    c.feeTokenId = (await (await tx.execute(hedera())).getReceipt(hedera())).tokenId!.toString();
  }
  saveChain(c);
  return c;
}

/** Splits a fee by kilometres; any rounding remainder goes to the last leg. */
export function splitByKm(feeRupees: number, legs: { badge: string; km: number }[]) {
  const total = legs.reduce((s, l) => s + l.km, 0) || 1;
  const units = toUnits(feeRupees);
  const shares = legs.map((l) => ({ badge: l.badge, km: l.km, units: Math.floor((units * l.km) / total) }));
  shares[shares.length - 1].units += units - shares.reduce((s, x) => s + x.units, 0);
  return shares;
}

/**
 * At booking: move the fee from treasury into escrow, and schedule the payout from escrow to every
 * driver by km. The schedule runs only once escrow signs it at delivery.
 */
export async function lockFee(code: string, feeRupees: number, legs: { badge: string; km: number }[]) {
  const { feeTokenId, escrowId } = await setupMoney();
  const units = toUnits(feeRupees);
  const lock = await new TransferTransaction()
    .addTokenTransfer(feeTokenId!, env.hederaOperatorId(), -units)
    .addTokenTransfer(feeTokenId!, escrowId!, units)
    .setTransactionMemo(`Daak ${code} fee locked`)
    .execute(hedera());
  const lockId = lock.transactionId.toString();
  await lock.getReceipt(hedera());

  const shares = splitByKm(feeRupees, legs);
  const payout = new TransferTransaction().setTransactionMemo(`Daak ${code} payout by km`);
  payout.addTokenTransfer(feeTokenId!, escrowId!, -units);
  for (const s of shares) payout.addTokenTransfer(feeTokenId!, await accountFor(s.badge), s.units);
  const sched = await new ScheduleCreateTransaction()
    .setScheduledTransaction(payout)
    .setScheduleMemo(`Daak ${code} payout`)
    .setAdminKey(operatorKey().publicKey)
    .execute(hedera());
  const scheduleId = (await sched.getReceipt(hedera())).scheduleId!.toString();
  return { lockTx: lockId, scheduleId, shares };
}

/** At delivery: escrow signs, the scheduled payout executes, and the network takes Daak's 2% on the way. */
export async function releaseFee(scheduleId: string) {
  const tx = await new ScheduleSignTransaction()
    .setScheduleId(ScheduleId.fromString(scheduleId))
    .freezeWith(hedera())
    .sign(keyFor("escrow"));
  const res = await tx.execute(hedera());
  await res.getReceipt(hedera());
  return { releaseTx: res.transactionId.toString() };
}

export const hashscan = (kind: "transaction" | "token" | "topic" | "account" | "schedule", id: string) =>
  `https://hashscan.io/testnet/${kind}/${id}`;
export { AccountId };
