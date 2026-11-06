import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge, badgesByRole } from "@/lib/arkiv";
import { pathBetween, stopName, meterFee, METER, BOOKING_FEE, bookingFee, WEIGHT_BANDS, MEASURE, PER_KG } from "@/lib/network";
import { readLog, workHistory } from "@/lib/history";
import { candidate } from "@/lib/booking";
import { planStretches } from "@/lib/timetable";

/**
 * Before paying, the shop sees the plan: the stretches from its stand to the receiver's, and for each one the
 * drivers who run it, best proven record first. The shop can take the suggestion or pick another driver.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { sender, receiver } = (await req.json()) as { sender: string; receiver: string };
  const [s, r] = await Promise.all([getBadge(sender), getBadge(receiver)]);
  if (!s?.stop || !r?.stop) return NextResponse.json({ error: "Shop or receiver has no bus stand" }, { status: 400 });
  const legs = pathBetween(s.stop, r.stop);
  if (!legs.length) return NextResponse.json({ error: `No route from ${stopName(s.stop)} to ${stopName(r.stop)}` }, { status: 400 });
  const [drivers, log] = await Promise.all([badgesByRole("driver"), readLog()]);
  // Each stretch's drivers, ranked by their proven record first...
  const ranked = await Promise.all(legs.map(async (l) => {
    const runs = drivers.filter((d) => d.legs.includes(l.id));
    const rows = await Promise.all(runs.map(async (d) => {
      const w = await workHistory(d.uid, log);
      return { badge: d, row: { uid: d.uid, name: d.name.split(",")[0], vehicle: d.vehicle, proven: w.proven, km: w.km, cleanRate: w.cleanRate } };
    }));
    rows.sort((a, b) => b.row.proven - a.row.proven || b.row.cleanRate - a.row.cleanRate || b.row.km - a.row.km);
    return rows;
  }));
  // ...then by which bus actually connects: earliest arrival first, drivers without bus times last.
  const plan = planStretches(legs.map((l, i) => ({ km: l.km, candidates: ranked[i].map((x) => candidate(x.badge, l.id)) })), new Date());
  const stretches = legs.map((l, i) => ({
    id: l.id, from: stopName(l.from), to: stopName(l.to), km: l.km,
    drivers: plan[i].options.map((o) => ({ ...ranked[i].find((x) => x.badge.uid === o.uid)!.row, departsAt: o.dep?.getTime() ?? null, arrivesAt: o.arr?.getTime() ?? null })),
  }));
  const etaAt = plan.at(-1)?.options[0]?.arr?.getTime() ?? null;
  const km = legs.reduce((sum, l) => sum + l.km, 0);
  const total = (m: number) => Math.round((m + bookingFee(m)) * 100) / 100;
  // The shop sees the price for every weight band before choosing one.
  const bands = WEIGHT_BANDS.map((b) => ({ id: b.id, label: b.label, maxKg: b.maxKg, meterRupees: meterFee(km, b.id), feeRupees: total(meterFee(km, b.id)) }));
  return NextResponse.json({
    from: stopName(s.stop), to: `${r.name}, ${stopName(r.stop)}`, receiverName: r.name, km, etaAt,
    feeRupees: total(meterFee(km)), meterRupees: meterFee(km), bookingFeeRupees: bookingFee(meterFee(km)), bands, measure: MEASURE, perKg: PER_KG, bookingFee: BOOKING_FEE,
    meter: `Rs ${METER.baseRupees} + Rs ${METER.perKmRupees} a km, times 1 + 0.1 for each charged kg over 5, plus ${BOOKING_FEE.percent}% booking`, stretches,
  });
}
