import { createHash } from "node:crypto";
import { chain } from "./hedera";
import { accountFor } from "./payout";
import { consignmentByCode } from "./arkiv";
import { advanceFor } from "./rules";

/**
 * A driver's work history, read from the public Hedera log only: anyone can recompute it, which is
 * what makes it worth something to a lender. Badges appear on the log as a short hash, never raw.
 */
export const badgeHash = (uid: string) => createHash("sha256").update(uid).digest("hex").slice(0, 12);

export type Msg = { t: string; code?: string; hop?: number; from?: string; to?: string; verdict?: string; at?: number; driver?: string; rupees?: number; saved?: number; km?: number };

export type LogMsg = Msg & { ts: number; pot?: string; status?: string; upi?: string | null; utr?: string | null; potRupees?: number };
export async function readLog(): Promise<LogMsg[]> {
  const topic = chain().topicId;
  const out: LogMsg[] = [];
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
export async function workHistory(uid: string, preloaded?: LogMsg[]): Promise<WorkHistory> {
  const me = badgeHash(uid);
  const acct = await accountFor(uid);
  const log = preloaded ?? (await readLog());
  const reviewed = new Set(log.filter((m) => m.t === "daak.reviewed").map((m) => m.code));
  // A driver's record counts the stretches they carried; the 0 km pickup is the shop handing over.
  const mine = log.filter((m) => m.t === "daak.handoff" && m.from === me && m.km !== 0);
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
  const advance = advanceFor({ proven, heldRecently: lastTen.some((h) => h.verdict === "held"), cleanRate, earned30dRupees });
  return { handoffs: mine.length, proven, held, km, earnedRupees, earned30dRupees, bachatRupees, cleanRate: Math.round(cleanRate * 100) / 100, advance };
}
