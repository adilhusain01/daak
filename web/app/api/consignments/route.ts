import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { recentConsignments, handoffsFor } from "@/lib/arkiv";
import { chain } from "@/lib/hedera";
import { readLog } from "@/lib/history";
import { accountFor } from "@/lib/payout";
import { holdbackStatus, isSplit } from "@/lib/split";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

async function paidAt(schedule?: string) {
  if (!schedule) return null;
  const r = await fetch(`${MIRROR}/schedules/${schedule}`, { cache: "no-store" });
  if (!r.ok) return null;
  const ts = (await r.json()).executed_timestamp as string | null;
  return ts ? Math.round(Number(ts) * 1000) : null;
}

/** Everything the operator dashboard shows, read from Arkiv and Hedera's mirror node. */
export async function GET(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const since = Number(process.env.DATA_SINCE ?? 0);
  const [all, log] = await Promise.all([recentConsignments(), readLog()]);
  const list = all.filter((c) => c.createdAt >= since);
  const rows = await Promise.all(
    list.map(async (c) => {
      // Who got what: the cash-out and Bachat entries on the public log, matched to each leg's driver.
      const drivers = await Promise.all(c.route.map(async (l) => ({ hop: l.hop, badge: l.from, account: await accountFor(l.from) })));
      const money = drivers.map((d) => {
        const cash = log.filter((m) => m.t === "daak.cashout" && m.code === c.code && m.driver === d.account);
        const saved = log.filter((m) => m.t === "daak.bachat" && m.code === c.code && m.driver === d.account);
        const adv = log.filter((m) => m.t === "daak.advance" && m.code === c.code && m.hop === d.hop).at(-1) as (typeof log)[number] & { pct?: number; heldRupees?: number } | undefined;
        return {
          hop: d.hop, account: d.account,
          advanceRupees: adv?.rupees ?? 0, advancePct: adv?.pct ?? c.route.find((l) => l.hop === d.hop)?.advancePct ?? null, heldRupees: adv?.heldRupees ?? null,
          upiRupees: cash.reduce((s, m) => s + (m.rupees ?? 0), 0),
          upiStatus: cash.at(-1)?.status ?? null,
          utr: cash.at(-1)?.utr ?? null,
          bachatRupees: saved.reduce((s, m) => s + (m.saved ?? 0), 0),
        };
      });
      const km = c.route.reduce((s, l) => s + (l.km ?? 0), 0);
      const handoffs = (await handoffsFor(c.code)).map(({ photo, fromBadge, toBadge, ...h }) => ({ ...h, hasPhoto: Boolean(photo) }));
      if (isSplit(c)) {
        // Split payout: delivered once the holdbacks are scheduled; they release on chain when the timer ends.
        const holdback = await holdbackStatus(c.code, log);
        const scheduledAt = log.find((m) => m.t === "daak.holdback" && m.code === c.code)?.ts ?? null;
        return { ...c, km, meter: "Rs 5 + Rs 0.50 a km", handoffs, money, holdback, paidAt: holdback && !holdback.deleted ? scheduledAt : null };
      }
      return { ...c, km, meter: "Rs 5 + Rs 0.50 a km", handoffs, money, holdback: null, paidAt: await paidAt(c.schedule) };
    }),
  );
  return NextResponse.json({ chain: chain(), consignments: rows });
}
