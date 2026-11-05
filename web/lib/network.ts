import { readFileSync } from "node:fs";
import path from "node:path";

/** The stops and stretches Daak runs on, and the meter that prices them. */
export type Stop = { id: string; name: string; lat?: number; lng?: number };
export type NetLeg = { id: string; from: string; to: string; km: number };
export const METER = { baseRupees: 5, perKmRupees: 0.5 };

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

export const meterFee = (km: number) => Math.round((METER.baseRupees + METER.perKmRupees * km) * 100) / 100;
