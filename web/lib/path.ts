import { readFileSync } from "node:fs";
import path from "node:path";
import type { Leg } from "./arkiv";
import { network } from "./network";

/** [lng, lat], the order maps use. */
export type LngLat = [number, number];
export type PathLeg = { hop: number; km: number; coords: LngLat[]; stop: LngLat; departsAt?: number; etaAt?: number };

const dist = (a: LngLat, b: LngLat) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The point a fraction of the way along a line, by distance (clamped to its ends). */
export function pointAlong(line: LngLat[], fraction: number): LngLat {
  if (!line.length) return [0, 0];
  const f = Math.min(1, Math.max(0, fraction));
  const total = line.slice(1).reduce((s, p, i) => s + dist(line[i], p), 0);
  let left = f * total;
  for (let i = 1; i < line.length; i++) {
    const d = dist(line[i - 1], line[i]);
    if (left <= d) {
      const t = d ? left / d : 0;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
    left -= d;
  }
  return line[line.length - 1];
}

/**
 * Where the parcel is: at the last stop it was handed over at, or, once the next bus has left, along the road by
 * how much of the bus's time has passed. An estimate from the timetable, never a GPS track.
 */
export function parcelPosition(legs: PathLeg[], handed: Set<number>, now = Date.now()): { at: LngLat; kind: "waiting" | "moving" | "arrived"; hop: number } {
  const last = legs[legs.length - 1];
  if (legs.every((l) => handed.has(l.hop))) return { at: last.stop, kind: "arrived", hop: last.hop };
  const i = legs.findIndex((l) => !handed.has(l.hop));
  const leg = legs[i];
  const from = i > 0 ? legs[i - 1].stop : leg.stop;
  if (leg.km > 0 && leg.departsAt && leg.etaAt && now >= leg.departsAt && leg.coords.length) {
    return { at: pointAlong(leg.coords, (now - leg.departsAt) / (leg.etaAt - leg.departsAt)), kind: "moving", hop: leg.hop };
  }
  return { at: from, kind: "waiting", hop: leg.hop };
}

let roads: Record<string, { km: number; coords: LngLat[] }> | null = null;
const roadShapes = () => (roads ??= JSON.parse(readFileSync(path.join(process.cwd(), "data", "roads.json"), "utf8")));

/** A booking's route on the map: each stretch along the road, each stop's position, the parcel's estimated position. */
export function routeOnMap(route: Leg[], handed: Set<number>, now = Date.now()) {
  const net = network();
  const at = (id: string): LngLat | null => { const s = net.stops.find((x) => x.id === id)?.at; return s ? [s[1], s[0]] : null; };
  const legs: PathLeg[] = [];
  for (const l of route) {
    if ((l.km ?? 0) === 0) {
      const first = route.find((x) => (x.km ?? 0) > 0);
      const nl = first && net.legs.find((x) => x.km === first.km && first.place.endsWith(net.stops.find((s) => s.id === x.to)?.name ?? "\u0000"));
      const p = nl && at(nl.from);
      if (p) legs.push({ hop: l.hop, km: 0, coords: [], stop: p, etaAt: l.etaAt });
      continue;
    }
    const nl = net.legs.find((x) => x.km === l.km && l.place.endsWith(net.stops.find((s) => s.id === x.to)?.name ?? "\u0000"));
    const p = nl && at(nl.to);
    if (!nl || !p) continue;
    legs.push({ hop: l.hop, km: l.km!, coords: roadShapes()[nl.id]?.coords ?? [], stop: p, departsAt: l.departsAt, etaAt: l.etaAt });
  }
  if (!legs.length) return null;
  return {
    legs: legs.map((l) => ({ hop: l.hop, coords: l.coords, stop: l.stop, done: handed.has(l.hop), etaAt: l.etaAt ?? null })),
    parcel: parcelPosition(legs, handed, now),
  };
}
