import { getBadge, type Leg } from "./arkiv";
import { pathBetween, stopName } from "./network";

/**
 * A booking's route: the pickup at the shop's stand (shop to the first driver, 0 km), then one stretch per
 * chosen driver, ending at the receiver's stand. Used for one-off parcels and for standing orders alike.
 */
export async function buildRoute(sender: string, receiver: string, drivers: string[]): Promise<{ route: Leg[]; label: string } | { error: string }> {
  const [s, r] = await Promise.all([getBadge(sender), getBadge(receiver)]);
  if (!s?.stop || !r?.stop) return { error: "Shop or receiver has no bus stand" };
  const legs = pathBetween(s.stop, r.stop);
  if (!legs.length) return { error: "No Daak route between these stands yet" };
  if (legs.length !== drivers.length) return { error: "Choose one driver for each stretch" };
  const route: Leg[] = [{ hop: 1, from: sender, to: drivers[0], place: stopName(s.stop), km: 0 }];
  legs.forEach((l, i) => route.push({
    hop: i + 2, from: drivers[i], to: i + 1 < legs.length ? drivers[i + 1] : receiver,
    place: i + 1 < legs.length ? stopName(l.to) : `${r.name}, ${stopName(l.to)}`, km: l.km,
  }));
  return { route, label: `Parcel from ${s.name.split(",")[0]} to ${r.name.split(",")[0]}` };
}
