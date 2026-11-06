import { ethers } from "ethers";
import { TransferTransaction } from "@hiero-ledger/sdk";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { env } from "./env";
import { chain, hedera, submitLog } from "./hedera";
import { accountFor } from "./payout";
import { readLog } from "./history";
import { COMPUTE_SHARE, computeEarmark, topUpPlan } from "./rules";

const PROVIDER = process.env.ZG_DIRECT_PROVIDER ?? "0xf4FB8d2bD856e672b5f9848b0eD235A20079B250";
const f = (v: bigint) => Number(ethers.formatEther(v));

/** Daak's own 0G compute account: what it holds, what is set aside for the sealed provider, and the wallet behind it. */
export async function computeAccount() {
  const w = new ethers.Wallet(env.zgKey(), new ethers.JsonRpcProvider(env.zgRpc()));
  const b = await createZGComputeNetworkBroker(w);
  const [l, providers, wallet] = await Promise.all([b.ledger.getLedger(), b.ledger.getProvidersWithBalance("inference"), w.provider!.getBalance(w.address)]);
  const p = providers.find(([a]) => a.toLowerCase() === PROVIDER.toLowerCase());
  return { b, address: w.address, available: f(l.availableBalance), total: f(l.totalBalance), providerLocked: p ? f(p[1]) : 0, wallet: f(wallet) };
}

/** Rupees per 0G, live from CoinGecko, or ZG_INR_PRICE when it does not answer. */
async function inrPer0g(): Promise<{ rate: number; source: string }> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=zero-gravity&vs_currencies=inr", { signal: AbortSignal.timeout(4000) });
    const rate = Number((await r.json())["zero-gravity"]?.inr);
    if (rate > 0) return { rate, source: "coingecko" };
  } catch { /* fall through */ }
  return { rate: Number(process.env.ZG_INR_PRICE ?? 13.79), source: "fixed" };
}

/** The 0G SDK prints each transaction hash instead of returning it; this keeps the last one it printed. */
async function withTxHash(run: () => Promise<void>): Promise<string | null> {
  const log = console.log;
  let hash: string | null = null;
  console.log = (...a: unknown[]) => { const m = String(a.join(" ")).match(/tx hash: (0x[0-9a-fA-F]{64})/); if (m) hash = m[1]; else log(...a); };
  try { await run(); } finally { console.log = log; }
  return hash;
}

/**
 * Each booking pays for its share of the agent's sealed checks. COMPUTE_SHARE of its booking fee moves in dINR on
 * Hedera from Daak's fee account to its compute budget account, and the same value in 0G (at the live price) goes into
 * Daak's 0G compute account, which pays the sealed provider. Both transactions go on the public HCS log with the booking,
 * so any check can be traced to the bookings that paid for it. Only the currency exchange between them is not on chain:
 * in production a payment partner buys the 0G with the rupees. Capped per day; the wallet always keeps gas.
 */
export async function fundCompute(code: string, bookingFeeRupees: number) {
  if (!process.env.ZG_PRIVATE_KEY) return null;
  const a = await computeAccount();
  const day = new Date().toISOString().slice(0, 10);
  const toppedToday = (await readLog().catch(() => []))
    .filter((m) => m.t === "daak.compute" && new Date(m.ts).toISOString().slice(0, 10) === day)
    .reduce((s, m) => s + Number((m as { zg?: number }).zg ?? 0), 0);
  const price = await inrPer0g();
  const share = computeEarmark({ bookingFeeRupees, inrPer0g: price.rate, wallet: a.wallet, toppedToday });
  let dinrTx: string | null = null, zgTx: string | null = null;
  if (share.paise > 0) {
    const { feeTokenId } = chain();
    const res = await new TransferTransaction()
      .addTokenTransfer(feeTokenId!, env.hederaOperatorId(), -share.paise).addTokenTransfer(feeTokenId!, await accountFor("compute"), share.paise)
      .setTransactionMemo(`Daak ${code} compute share`).execute(hedera());
    await res.getReceipt(hedera());
    dinrTx = res.transactionId.toString();
    zgTx = await withTxHash(() => a.b.ledger.depositFund(share.zg));
  }
  const refill = topUpPlan({ available: a.available + share.zg, providerLocked: a.providerLocked, wallet: a.wallet, toppedToday: Infinity }).toProvider;
  if (refill) await a.b.ledger.transferFund(PROVIDER, "inference", ethers.parseEther(String(refill)));
  if (!share.paise && !refill) return { ...share, dinrTx, zgTx };
  const after = await computeAccount();
  await submitLog({
    t: "daak.compute", code, sharePct: COMPUTE_SHARE * 100, rupees: share.paise / 100, dinrTx, zg: share.zg, zgTx, inrPer0g: price.rate, priceSource: price.source,
    toProvider: refill, available: after.available, providerLocked: after.providerLocked, account: a.address,
  }).catch(() => null);
  return { ...share, dinrTx, zgTx, refill, available: after.available, providerLocked: after.providerLocked };
}
