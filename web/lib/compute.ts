import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { env } from "./env";
import { submitLog } from "./hedera";
import { readLog } from "./history";
import { topUpPlan } from "./rules";

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

/**
 * After a booking, the agent keeps its own sealed checks paid for: it tops up its 0G compute account when it runs low
 * (capped per day) and refills the provider's share. Every move goes on the public HCS log with the booking that
 * triggered it. In production the top-up is bought with part of Daak's booking fee; on this build it comes from the
 * agent's 0G wallet.
 */
export async function fundCompute(code: string) {
  if (!process.env.ZG_PRIVATE_KEY) return null;
  const a = await computeAccount();
  const day = new Date().toISOString().slice(0, 10);
  const toppedToday = (await readLog().catch(() => []))
    .filter((m) => m.t === "daak.compute" && new Date(m.ts).toISOString().slice(0, 10) === day)
    .reduce((s, m) => s + Number((m as { deposit?: number }).deposit ?? 0), 0);
  const plan = topUpPlan({ ...a, toppedToday });
  if (!plan.deposit && !plan.toProvider) return { ...plan, available: a.available, providerLocked: a.providerLocked };
  if (plan.deposit) await a.b.ledger.depositFund(plan.deposit);
  if (plan.toProvider) await a.b.ledger.transferFund(PROVIDER, "inference", ethers.parseEther(String(plan.toProvider)));
  const after = await computeAccount();
  await submitLog({ t: "daak.compute", code, deposit: plan.deposit, toProvider: plan.toProvider, available: after.available, providerLocked: after.providerLocked, wallet: Number(after.wallet.toFixed(4)), account: a.address }).catch(() => null);
  return { ...plan, available: after.available, providerLocked: after.providerLocked };
}
