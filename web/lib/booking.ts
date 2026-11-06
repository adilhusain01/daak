import { getBadge, type BadgeRow, type Leg } from "./arkiv";
import { network, pathBetween, stopName } from "./network";
import { decodeTimetables, timesFor, type Candidate } from "./timetable";

/** A driver as a timetable candidate for one stretch: their bus time on it and their days off. */
export const candidate = (b: Pick<BadgeRow, "uid" | "timetable" | "away">, legId: string): Candidate =>
  ({ uid: b.uid, tt: decodeTimetables(b.timetable)[legId] ?? null, away: b.away ?? [] });

/**
 * A booking's route: the pickup at the shop's stand (shop to the first driver, 0 km), then one stretch per
 * chosen driver, ending at the receiver's stand. Each stretch carries its bus's departure and the ETA at its
 * stop, from the drivers' published bus times; the pickup's ETA is the first bus's departure.
 * Used for one-off parcels and for standing orders alike.
 */
export async function buildRoute(sender: string, receiver: string, drivers: string[], readyAt = new Date()): Promise<{ route: Leg[]; label: string } | { error: string }> {
  const [s, r] = await Promise.all([getBadge(sender), getBadge(receiver)]);
  if (!s?.stop || !r?.stop) return { error: "Shop or receiver has no bus stand" };
  const legs = pathBetween(s.stop, r.stop);
  if (!legs.length) return { error: "No Daak route between these stands yet" };
  if (legs.length !== drivers.length) return { error: "Choose one driver for each stretch" };
  const badges = await Promise.all(drivers.map((d) => getBadge(d)));
  if (badges.some((b) => !b)) return { error: "Every driver must have joined Daak" };
  const times = timesFor(legs.map((l, i) => ({ km: l.km, driver: candidate(badges[i]!, l.id) })), readyAt);
  const stand = (id: string) => { const a = network().stops.find((x) => x.id === id)?.at; return a ? { lat: a[0], lng: a[1] } : {}; };
  const route: Leg[] = [{ hop: 1, from: sender, to: drivers[0], place: stopName(s.stop), km: 0, etaAt: times[0].dep?.getTime(), ...stand(s.stop) }];
  legs.forEach((l, i) => route.push({
    hop: i + 2, from: drivers[i], to: i + 1 < legs.length ? drivers[i + 1] : receiver,
    place: i + 1 < legs.length ? stopName(l.to) : `${r.name}, ${stopName(l.to)}`, km: l.km,
    departsAt: times[i].dep?.getTime(), etaAt: times[i].arr?.getTime(), ...stand(l.to),
  }));
  return { route, label: `Parcel from ${s.name.split(",")[0]} to ${r.name.split(",")[0]}` };
}
