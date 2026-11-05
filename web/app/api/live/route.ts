import { NextResponse } from "next/server";
import { recentConsignments, handoffsFor } from "@/lib/arkiv";
import { chain } from "@/lib/hedera";
import { readLog } from "@/lib/history";
import { band } from "@/lib/network";
import { holdbackStatus, isSplit } from "@/lib/split";
import { isPlaceholder } from "@/lib/standing";

/**
 * Every recent delivery, public and read-only: stops, verdicts, money per stretch and the proof links.
 * No photos, no badges, no phone, UPI or bank details: those stay behind the operator passcode.
 */
export async function GET() {
  const since = Number(process.env.DATA_SINCE ?? 0);
  const [all, log] = await Promise.all([recentConsignments(), readLog()]);
  const list = all.filter((c) => c.createdAt >= since && !isPlaceholder(c.parcel));
  const rows = await Promise.all(list.map(async (c) => {
    const handoffs = (await handoffsFor(c.code)).map((h) => ({ key: h.key, hop: h.hop, verdict: h.verdict, place: h.place, at: h.at, reason: h.reason, hcs: h.hcs, zgRequestId: h.zgRequestId, signed: undefined }));
    const money = c.route.filter((l) => (l.km ?? 0) > 0).map((l) => {
      const adv = log.filter((m) => m.t === "daak.advance" && m.code === c.code && m.hop === l.hop).at(-1) as ((typeof log)[number] & { pct?: number; heldRupees?: number; tx?: string }) | undefined;
      const answer = (log.filter((m) => m.t === "daak.job" && m.code === c.code && m.hop === l.hop).at(-1) as { decision?: string } | undefined)?.decision ?? null;
      return { hop: l.hop, km: l.km, pct: l.advancePct ?? null, advanceRupees: adv?.rupees ?? 0, heldRupees: adv?.heldRupees ?? null, tx: adv?.tx ?? null, answer };
    });
    const booked = log.find((m) => m.t === "daak.booked" && m.code === c.code);
    return {
      code: c.code, label: c.label, createdAt: c.createdAt, feeRupees: c.feeRupees, weight: band(c.weight ?? "s").label,
      km: c.route.reduce((s, l) => s + (l.km ?? 0), 0), route: c.route.map((l) => ({ hop: l.hop, place: l.place, km: l.km ?? 0 })),
      handoffs, money, holdback: isSplit(c) ? await holdbackStatus(c.code, log) : null, bookedAt: booked?.ts ?? null,
    };
  }));
  return NextResponse.json({ chain: chain(), deliveries: rows }, { headers: { "Cache-Control": "public, s-maxage=20" } });
}
