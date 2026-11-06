import { readFileSync } from "node:fs";
import path from "node:path";

/** The stops and stretches Daak runs on, and the meter that prices them. */
export type Stop = { id: string; name: string; lat?: number; lng?: number; /** The stand's position (OSM, or the town's head post office): drawn on maps and copied onto each booking's legs for the stand check. */ at?: [number, number] };
export type NetLeg = { id: string; from: string; to: string; km: number };
export const METER = { baseRupees: 5, perKmRupees: 0.5 };
/**
 * Daak's own fee per booking: a percentage of the meter, with a floor, on top of the meter.
 * The meter goes to the drivers in full (less the 2% token fee).
 */
export const BOOKING_FEE = { percent: Number(process.env.BOOKING_FEE_PERCENT ?? 12), minRupees: Number(process.env.BOOKING_FEE_MIN_RUPEES ?? 5) };
export const bookingFee = (meterRupees: number) =>
  Math.max(BOOKING_FEE.minRupees, Math.round(meterRupees * BOOKING_FEE.percent) / 100);

/** What the shop paid for a booking: the drivers' meter plus Daak's booking fee (the x402 total). */
export const paidFor = (meterRupees: number) => Math.round((meterRupees + bookingFee(meterRupees)) * 100) / 100;

export function network(): { stops: Stop[]; legs: NetLeg[] } {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data", "network.json"), "utf8"));
}

export const stopName = (id: string) => network().stops.find((s) => s.id === id)?.name ?? id;

/** The chain of stretches from one stop to another (the network is a line of bus routes, so a walk finds it). */
export function pathBetween(fromStop: string, toStop: string): NetLeg[] {
  const { legs } = network();
  const out: NetLeg[] = [];
  let at = fromStop;
  for (let guard = 0; at !== toStop && guard < 20; guard++) {
    const next = legs.find((l) => l.from === at);
    if (!next) return [];
    out.push(next);
    at = next.to;
  }
  return at === toStop ? out : [];
}

/**
 * Weight bands: the whole meter is multiplied by the band's factor. Published with the meter, so a fee always
 * matches its distance and weight. Over 50 kg is not a bus parcel.
 */
export const WEIGHT_BANDS = [
  { id: "s", maxKg: 5, factor: 1, label: "Up to 5 kg" },
  { id: "m", maxKg: 15, factor: 1.5, label: "5 to 15 kg" },
  { id: "l", maxKg: 30, factor: 2, label: "15 to 30 kg" },
  { id: "xl", maxKg: 50, factor: 3, label: "30 to 50 kg" },
] as const;
export type BandId = (typeof WEIGHT_BANDS)[number]["id"];
export const bandFor = (kg: number) => WEIGHT_BANDS.find((b) => kg <= b.maxKg) ?? null;
export const band = (id: string = "s") => {
  const b = WEIGHT_BANDS.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown weight band ${id}`);
  return b;
};

/**
 * The shop measures the parcel; Daak prices it. Like a courier, the charge is on the larger of the weight on the
 * scale and the volume weight (length x width x height in cm, divided by 5,000), and that weight picks the band.
 * Longer than 120 cm does not fit a bus parcel rack. Published in /api/plan so the app can show the price as the
 * shop types; the server measures again when it books.
 */
export const MEASURE = { volumeDivisor: 5000, maxSideCm: 120 } as const;
export type Measured = { kg: number; lengthCm: number; widthCm: number; heightCm: number };
export function measure(m: Measured): { volumeKg: number; chargeableKg: number; band: (typeof WEIGHT_BANDS)[number]; spec: string } | { error: string } {
  const sides = [m.lengthCm, m.widthCm, m.heightCm];
  if (![m.kg, ...sides].every((x) => Number.isFinite(x) && x > 0)) return { error: "Enter the weight and all three sides" };
  if (Math.max(...sides) > MEASURE.maxSideCm) return { error: `Longer than ${MEASURE.maxSideCm} cm does not fit a bus parcel rack` };
  const volumeKg = Math.round((m.lengthCm * m.widthCm * m.heightCm) / MEASURE.volumeDivisor * 10) / 10;
  const chargeableKg = Math.max(m.kg, volumeKg);
  const b = bandFor(chargeableKg);
  if (!b) return { error: `Charged as ${chargeableKg} kg: over 50 kg is not a bus parcel` };
  return { volumeKg, chargeableKg, band: b, spec: `kg:${Math.round(chargeableKg * 10) / 10}|${[m.lengthCm, m.widthCm, m.heightCm].map((x) => Math.round(x)).join("x")}` };
}

/**
 * Every charged kilogram over 5 adds a tenth of the meter (Adil, 2026-11-06: the drivers' pay should follow the
 * parcel, not only the km). Up to 5 kg is x1, 12 kg x1.7, 25 kg x3, 50 kg x5.5. Published with the meter.
 */
export const PER_KG = { freeKg: 5, perKg: 0.1, maxKg: 50 } as const;
export const kgFactor = (kg: number) => Math.round((1 + PER_KG.perKg * Math.max(0, kg - PER_KG.freeKg)) * 100) / 100;

/**
 * What the weight field of a booking holds: an old band id (s, m, l, xl), or a measured parcel as
 * "kg:<charged kg>|<L>x<W>x<H>" (the sides optional). Anything else is refused, never priced as the lightest.
 */
export function weightSpec(w: string = "s"): { factor: number; label: string; kg?: number } {
  if (w.startsWith("kg:")) {
    const [kgPart, dims] = w.slice(3).split("|");
    const kg = Number(kgPart);
    if (!Number.isFinite(kg) || kg <= 0 || kg > PER_KG.maxKg) throw new Error(`Charged weight ${kgPart} kg is not a bus parcel`);
    return { factor: kgFactor(kg), kg, label: `${kg} kg charged${dims ? ` (${dims.replaceAll("x", " x ")} cm)` : ""}` };
  }
  const b = band(w);
  return { factor: b.factor, label: b.label };
}

export const meterFee = (km: number, weight: string = "s") =>
  Math.round((METER.baseRupees + METER.perKmRupees * km) * weightSpec(weight).factor * 100) / 100;
