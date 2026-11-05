import { PrivateKey, ScheduleCreateTransaction, ScheduleDeleteTransaction, ScheduleId, Timestamp, TransferTransaction } from "@hiero-ledger/sdk";
import type { Leg } from "./arkiv";
import { env } from "./env";
import { chain, hedera, logHandoff } from "./hedera";
import { readLog, type LogMsg } from "./history";
import { accountFor, keyFor, splitByKm, toUnits } from "./payout";
import { poolPayout, poolUnits, splitAdvance } from "./rules";
import { cashOutAll } from "./settle";

/**
 * Split payout. Each driver's share of a delivery is paid in two parts from escrow:
 * the advance (50, 70 or 90% by their record) when the next person confirms the handover, and the
 * holdback when the parcel is delivered. The holdbacks go into one Hedera scheduled transfer that waits
 * HOLDBACK_HOURS and then executes itself on the network; a dispute in that window deletes it, and the
 * liable leg's holdback repays the shop, topped up from the protection pool.
 */
export const HOLDBACK_HOURS = Number(process.env.HOLDBACK_HOURS ?? 24);
export const POOL_CAP_RUPEES = Number(process.env.POOL_CAP_RUPEES ?? 2000);
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
const operatorKey = () => PrivateKey.fromStringECDSA(env.hederaOperatorKey());

type C = { code: string; feeRupees: number; route: Leg[]; schedule?: string };

/** Older bookings scheduled the whole payout at booking; new ones split it. */
export const isSplit = (c: C) => !c.schedule;

/** Every carrying leg's pay, advance and holdback, in dINR units. The 0 km pickup earns nothing. */
export function legPay(c: C) {
  const legs = c.route.filter((l) => (l.km ?? 0) > 0);
  const shares = splitByKm(c.feeRupees, legs.map((l) => ({ badge: l.from, km: l.km! })));
  return legs.map((l, i) => ({ hop: l.hop, badge: l.from, km: l.km!, pct: l.advancePct ?? 50, units: shares[i].units, ...splitAdvance(shares[i].units, l.advancePct ?? 50) }));
}

const advancesPaid = (code: string, log: LogMsg[]) => new Set(log.filter((m) => m.t === "daak.advance" && m.code === code).map((m) => m.hop));
const holdbackOf = (code: string, log: LogMsg[]) => log.filter((m) => m.t === "daak.holdback" && m.code === code).at(-1) as (LogMsg & { schedule?: string; releasesAt?: number }) | undefined;

async function escrowPays(code: string, memo: string, to: { account: string; units: number }[]) {
  const { feeTokenId, escrowId } = chain();
  const total = to.reduce((s, t) => s + t.units, 0);
  const tx = new TransferTransaction().setTransactionMemo(`Daak ${code} ${memo}`).addTokenTransfer(feeTokenId!, escrowId!, -total);
  for (const t of to) tx.addTokenTransfer(feeTokenId!, t.account, t.units);
  const res = await (await tx.freezeWith(hedera()).sign(keyFor("escrow"))).execute(hedera());
  await res.getReceipt(hedera());
  return res.transactionId.toString();
}

/** The advance for one leg, paid when that driver's handover is confirmed. Pays once per leg. */
export async function payAdvance(c: C, hop: number, log?: LogMsg[]) {
  const leg = legPay(c).find((l) => l.hop === hop);
  if (!leg || leg.advance <= 0) return null;
  if (advancesPaid(c.code, log ?? (await readLog())).has(hop)) return null;
  const account = await accountFor(leg.badge);
  const tx = await escrowPays(c.code, `advance ${leg.pct}% hop ${hop}`, [{ account, units: leg.advance }]);
  const hcs = await logHandoff({ t: "daak.advance", code: c.code, hop, driver: account, pct: leg.pct, rupees: leg.advance / 100, heldRupees: leg.holdback / 100, tx });
  await cashOutAll(c, [leg.badge]).catch((e) => console.error("cashout", e));
  return { hop, tx, hcs };
}

/**
 * At delivery: every holdback goes into one scheduled transfer that Hedera executes by itself after
 * HOLDBACK_HOURS (wait-for-expiry). Escrow signs it now, so no server has to be up when it runs.
 */
export async function scheduleHoldbacks(c: C, log?: LogMsg[]) {
  const l = log ?? (await readLog());
  if (holdbackOf(c.code, l)) return null;
  const { feeTokenId, escrowId } = chain();
  const legs = legPay(c).filter((x) => x.holdback > 0);
  if (!legs.length) return null;
  const total = legs.reduce((s, x) => s + x.holdback, 0);
  const inner = new TransferTransaction().setTransactionMemo(`Daak ${c.code} holdbacks`).addTokenTransfer(feeTokenId!, escrowId!, -total);
  for (const x of legs) inner.addTokenTransfer(feeTokenId!, await accountFor(x.badge), x.holdback);
  const releasesAt = Date.now() + HOLDBACK_HOURS * 3600_000;
  const tx = await new ScheduleCreateTransaction()
    .setScheduledTransaction(inner)
    .setWaitForExpiry(true)
    .setExpirationTime(Timestamp.fromDate(new Date(releasesAt)))
    .setAdminKey(operatorKey().publicKey)
    .setScheduleMemo(`Daak ${c.code} holdbacks, release ${new Date(releasesAt).toISOString().slice(0, 16)}Z`)
    .freezeWith(hedera()).sign(keyFor("escrow"));
  const schedule = (await (await tx.execute(hedera())).getReceipt(hedera())).scheduleId!.toString();
  const hcs = await logHandoff({ t: "daak.holdback", code: c.code, schedule, releasesAt, rupees: total / 100 });
  return { schedule, releasesAt, hcs };
}

/** Everything confirmed is paid: missing advances now, holdbacks on their timer. Used at delivery, review, recheck and "pay anyway". */
export async function settleDelivered(c: C) {
  const log = await readLog();
  const paid = advancesPaid(c.code, log);
  for (const leg of legPay(c)) if (!paid.has(leg.hop)) await payAdvance(c, leg.hop, log);
  return scheduleHoldbacks(c, log);
}

/** Where a split delivery's money stands, for the dashboard and tracking. */
export async function holdbackStatus(code: string, log: LogMsg[]) {
  const h = holdbackOf(code, log);
  if (!h?.schedule) return null;
  const r = await fetch(`${MIRROR}/schedules/${h.schedule}`, { cache: "no-store" });
  const j = r.ok ? await r.json() : {};
  return { schedule: h.schedule, releasesAt: h.releasesAt ?? null, rupees: h.rupees ?? 0, executedAt: j.executed_timestamp ? Math.round(Number(j.executed_timestamp) * 1000) : null, deleted: Boolean(j.deleted) };
}

async function poolBalanceUnits() {
  const { feeTokenId } = chain();
  const r = await fetch(`${MIRROR}/accounts/${await accountFor("pool")}/tokens?token.id=${feeTokenId}`, { cache: "no-store" });
  return r.ok ? Number((await r.json()).tokens?.[0]?.balance ?? 0) : 0;
}

/** At booking Daak moves POOL_POINTS of the meter from its booking fee into the protection pool, until the pool holds its cap. */
export async function fundPool(code: string, meterRupees: number) {
  const units = Math.min(poolUnits(toUnits(meterRupees)), Math.max(0, toUnits(POOL_CAP_RUPEES) - (await poolBalanceUnits())));
  if (units <= 0) return null;
  const { feeTokenId } = chain();
  const res = await new TransferTransaction()
    .addTokenTransfer(feeTokenId!, env.hederaOperatorId(), -units).addTokenTransfer(feeTokenId!, await accountFor("pool"), units)
    .setTransactionMemo(`Daak ${code} to protection pool`).execute(hedera());
  await res.getReceipt(hedera());
  return { rupees: units / 100, tx: res.transactionId.toString() };
}

/**
 * A lost or damaged parcel. The liable leg is the one whose handover was held (or the one the reviewer names).
 * That driver's unpaid pay repays the shop; drivers who handed over cleanly get their holdbacks now; legs never
 * carried go back to the shop; the pool tops the refund up to the declared value, within its cap.
 */
export async function refundLiable(c: C, liableHop: number, valueRupees = 0) {
  const log = await readLog();
  const h = holdbackOf(c.code, log);
  if (h?.schedule) {
    const s = await holdbackStatus(c.code, log);
    if (s?.executedAt) throw new Error("The holdback already released; the window for a claim has passed.");
    if (!s?.deleted) {
      const del = await new ScheduleDeleteTransaction().setScheduleId(ScheduleId.fromString(h.schedule)).freezeWith(hedera()).sign(operatorKey());
      await (await del.execute(hedera())).getReceipt(hedera());
    }
  }
  const paid = advancesPaid(c.code, log);
  const clean: { account: string; units: number }[] = [];
  let shopUnits = 0;
  for (const leg of legPay(c)) {
    if (leg.hop === liableHop) shopUnits += paid.has(leg.hop) ? leg.holdback : leg.units;
    else if (paid.has(leg.hop)) clean.push({ account: await accountFor(leg.badge), units: leg.holdback });
    else shopUnits += leg.units;
  }
  const out: { holdbacksTx?: string; refundTx?: string; poolTx?: string } = {};
  if (clean.length) out.holdbacksTx = await escrowPays(c.code, "holdbacks to clean legs", clean);
  const { feeTokenId, escrowId } = chain();
  if (shopUnits > 0) {
    const res = await (await new TransferTransaction()
      .addTokenTransfer(feeTokenId!, escrowId!, -shopUnits).addTokenTransfer(feeTokenId!, env.hederaOperatorId(), shopUnits)
      .setTransactionMemo(`Daak ${c.code} refund, liable hop ${liableHop}`).freezeWith(hedera()).sign(keyFor("escrow"))).execute(hedera());
    await res.getReceipt(hedera());
    out.refundTx = res.transactionId.toString();
  }
  const fromPool = Math.min(toUnits(poolPayout(valueRupees, shopUnits / 100, POOL_CAP_RUPEES)), await poolBalanceUnits());
  if (fromPool > 0) {
    const res = await (await new TransferTransaction()
      .addTokenTransfer(feeTokenId!, await accountFor("pool"), -fromPool).addTokenTransfer(feeTokenId!, env.hederaOperatorId(), fromPool)
      .setTransactionMemo(`Daak ${c.code} protection pool claim`).freezeWith(hedera()).sign(keyFor("pool"))).execute(hedera());
    await res.getReceipt(hedera());
    out.poolTx = res.transactionId.toString();
  }
  await cashOutAll(c, legPay(c).filter((l) => l.hop !== liableHop && paid.has(l.hop)).map((l) => l.badge)).catch(() => null);
  return { liableHop, refundRupees: shopUnits / 100, poolRupees: fromPool / 100, ...out };
}
