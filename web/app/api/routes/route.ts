import { METER, BOOKING_FEE, bookingFee } from "@/lib/network";
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";


/** The routes a shop can book, with the meter price, so the shop sees the fee before paying. */
export async function GET() {
  const demo = JSON.parse(readFileSync(path.join(process.cwd(), "data", "demo-route.json"), "utf8"));
  const km = demo.route.reduce((s: number, l: { km?: number }) => s + (l.km ?? 0), 0);
  return NextResponse.json({
    routes: [{
      id: "knp-gkp",
      label: demo.label,
      from: "Kanpur",
      to: demo.route.at(-1).place,
      stops: demo.route.map((l: { place: string; km?: number }) => ({ place: l.place, km: l.km ?? 0 })),
      km,
      feeRupees: METER.baseRupees + METER.perKmRupees * km + bookingFee(METER.baseRupees + METER.perKmRupees * km),
      meter: `Rs ${METER.baseRupees} + Rs ${METER.perKmRupees} a km, plus ${BOOKING_FEE.percent}% booking`,
    }],
  });
}
