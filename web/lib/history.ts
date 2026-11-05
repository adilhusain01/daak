import { createHash } from "node:crypto";
import { chain } from "./hedera";
import { accountFor } from "./payout";
import { consignmentByCode } from "./arkiv";

/**
 * A driver's work history, read from the public Hedera log only: anyone can recompute it, which is
 * what makes it worth something to a lender. Badges appear on the log as a short hash, never raw.
 */
export const badgeHash = (uid: string) => createHash("sha256").update(uid).digest("hex").slice(0, 12);

type Msg = { t: string; code?: string; hop?: number; from?: string; to?: string; verdict?: string; at?: number; driver?: string; rupees?: number; saved?: number; km?: number };

async function readLog(): Promise<(Msg & { ts: number })[]> {
  const topic = chain().topicId;
  const out: (Msg & { ts: number })[] = [];
  let next: string | null = `/api/v1/topics/${topic}/messages?limit=100&order=asc`;
  while (next) {
    const r: Response = await fetch(`https://testnet.mirrornode.hedera.com${next}`, { cache: "no-store" });
    const j = await r.json();
    for (const m of j.messages ?? []) {
      try {
        out.push({ ...JSON.parse(Buffer.from(m.message, "base64").toString("utf8")), ts: Math.round(Number(m.consensus_timestamp) * 1000) });
      } catch { /* not ours */ }
    }
    next = j.links?.next ?? null;
  }
  return out;
}

export type WorkHistory = {
  handoffs: number; proven: number; held: number; km: number; earnedRupees: number; earned30dRupees: number;
  bachatRupees: number; cleanRate: number; advance: { eligibleRupees: number; reason: string };
};

/** Proven = checked green by 0G, or on a delivery a person reviewed and paid. Held never counts. */
export async function workHistory(uid: string): Promise<WorkHistory> {
  const me = badgeHash(uid);
  const acct = await accountFor(uid);
  const log = await readLog();
  const reviewed = new Set(log.filter((m) => m.t === "daak.reviewed").map((m) => m.code));
  const mine = log.filter((m) => m.t === "daak.handoff" && m.from === me);
  const kmCache = new Map<string, number[]>();
  let km = 0, proven = 0, held = 0;
  for (const h of mine) {
    if (h.verdict === "held") { held++; continue; }
    if (h.verdict === "green" || reviewed.has(h.code)) {
      proven++;
      let legs = kmCache.get(h.code!);
      if (!legs) {
        const c = await consignmentByCode(h.code!);
        legs = c ? c.route.map((l) => l.km ?? 0) : [];
        kmCache.set(h.code!, legs);
      }
      km += h.km ?? legs[(h.hop ?? 1) - 1] ?? 0;
    }
  }
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const paid = log.filter((m) => (m.t === "daak.cashout" || m.t === "daak.bachat") && m.driver === acct);
  const sum = (xs: Msg[], k: "rupees" | "saved") => Math.round(xs.reduce((s, m) => s + (m[k] ?? 0), 0) * 100) / 100;
  const earnedRupees = sum(paid.filter((m) => m.t === "daak.cashout"), "rupees") + sum(paid.filter((m) => m.t === "daak.bachat"), "saved");
  const earned30dRupees = sum(paid.filter((m) => m.t === "daak.cashout" && m.ts > monthAgo), "rupees") + sum(paid.filter((m) => m.t === "daak.bachat" && m.ts > monthAgo), "saved");
  const bachatRupees = sum(paid.filter((m) => m.t === "daak.bachat"), "saved");
  // Pending reviews are neither clean nor dirty; only proven and held count.
  const cleanRate = proven + held ? proven / (proven + held) : 0;
  const lastTen = mine.slice(-10);

  // The rule is public and simple on purpose: a lender (in production, a licensed partner) can audit it.
  let advance = { eligibleRupees: 0, reason: "" };
  if (proven < 2) advance.reason = "Needs 2 proven deliveries";
  else if (lastTen.some((h) => h.verdict === "held")) advance.reason = "A recent handoff was held";
  else if (cleanRate < 0.9) advance.reason = "Clean record below 90%";
  else {
    const limit = Math.min(5000, Math.floor((earned30dRupees * 0.25) / 10) * 10);
    advance = limit > 0 ? { eligibleRupees: limit, reason: "25% of the last 30 days' proven earnings, up to Rs 5,000" } : { eligibleRupees: 0, reason: "No paid deliveries in the last 30 days" };
  }
  return { handoffs: mine.length, proven, held, km, earnedRupees, earned30dRupees, bachatRupees, cleanRate: Math.round(cleanRate * 100) / 100, advance };
}
