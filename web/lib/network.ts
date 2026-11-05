import { readFileSync } from "node:fs";
import path from "node:path";

/** The stops and stretches Daak runs on, and the meter that prices them. */
export type Stop = { id: string; name: string; lat?: number; lng?: number; /** Map position only (OSM stand, or the town head post office); never used for the 500 m handoff rule. */ at?: [number, number] };
export type NetLeg = { id: string; from: string; to: string; km: number };
export const METER = { baseRupees: 5, perKmRupees: 0.5 };
/**
 * Daak's own fee per booking: a percentage of the meter, with a floor, on top of the meter.
 * The meter goes to the drivers in full (less the 2% token fee).
 */
export const BOOKING_FEE = { percent: Number(process.env.BOOKING_FEE_PERCENT ?? 12), minRupees: Number(process.env.BOOKING_FEE_MIN_RUPEES ?? 5) };
export const bookingFee = (meterRupees: number) =>
  Math.max(BOOKING_FEE.minRupees, Math.round(meterRupees * BOOKING_FEE.percent) / 100);

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

export const meterFee = (km: number, bandId: string = "s") =>
  Math.round((METER.baseRupees + METER.perKmRupees * km) * band(bandId).factor * 100) / 100;
