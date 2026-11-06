import { badgesByRole, getBadge, handoffsFor, patchRoute, type Leg } from "./arkiv";
import { candidate } from "./booking";
import { logHandoff } from "./hedera";
import { badgeHash, readLog, workHistory, type LogMsg } from "./history";
import { network, stopName } from "./network";
import { CHANGE_MINUTES, planStretches, timesFor } from "./timetable";

/** The published stretch a route leg runs on (matched by its stop and distance). */
export function legIdOf(leg: Leg) {
  return network().legs.find((x) => x.km === leg.km && leg.place.endsWith(stopName(x.to)))?.id ?? null;
}

/**
 * A driver declined a stretch or cannot drive that day: offer it to the next driver who runs it, has not declined
 * it, and whose bus connects; then re-plan the times from that stretch on. Escrow is untouched (pay follows the
 * stretch, not the person). Returns the new driver, or null when nobody can take it (the operator steps in).
 */
export async function reassign(c: { code: string; route: Leg[] }, hop: number, log?: LogMsg[]) {
  const l = log ?? (await readLog());
  const leg = c.route.find((x) => x.hop === hop);
  const legId = leg && legIdOf(leg);
  if (!leg || !legId) return null;
  const done = new Set((await handoffsFor(c.code)).filter((h) => h.verdict !== "held").map((h) => h.hop));
  if (done.has(hop)) return null; // already handed over: nothing to reassign
  const declined = new Set(l.filter((m) => m.t === "daak.job" && m.code === c.code && m.hop === hop && (m as { decision?: string }).decision === "decline").map((m) => m.driver));
  const runs = (await badgesByRole("driver")).filter((d) => d.legs.includes(legId) && d.uid !== leg.from && !declined.has(badgeHash(d.uid)));
  const prev = c.route.find((x) => x.hop === hop - 1);
  const readyAt = new Date(Math.max(Date.now(), (prev?.etaAt ?? 0) + CHANGE_MINUTES * 60_000));
  const pick = planStretches([{ km: leg.km ?? 0, candidates: runs.map((d) => candidate(d, legId)) }], readyAt)[0]?.options[0];
  if (!pick) {
    await logHandoff({ t: "daak.unassigned", code: c.code, hop });
    return null;
  }
  const route = c.route.map((x) => ({ ...x }));
  const at = route.findIndex((x) => x.hop === hop);
  route[at].from = pick.uid;
  if (at > 0) route[at - 1].to = pick.uid;
  route[at].advancePct = (await workHistory(pick.uid, l).catch(() => null))?.tier.advancePct ?? 50;
  // Re-plan this stretch and every later one with their drivers' bus times.
  const later = route.slice(at).filter((x) => (x.km ?? 0) > 0);
  const badges = await Promise.all(later.map((x) => getBadge(x.from)));
  const times = timesFor(later.map((x, i) => ({ km: x.km ?? 0, driver: candidate(badges[i] ?? { uid: x.from }, legIdOf(x) ?? "") })), readyAt);
  later.forEach((x, i) => { x.departsAt = times[i].dep?.getTime(); x.etaAt = times[i].arr?.getTime(); });
  if (at > 0 && route[at].departsAt) route[at - 1].etaAt ??= route[at].departsAt;
  await patchRoute(c.code, route);
  await logHandoff({ t: "daak.reassigned", code: c.code, hop, to: badgeHash(pick.uid), departsAt: route[at].departsAt ?? null });
  return { uid: pick.uid, name: (await getBadge(pick.uid))?.name.split(",")[0] ?? "another driver", departsAt: route[at].departsAt ?? null };
}
