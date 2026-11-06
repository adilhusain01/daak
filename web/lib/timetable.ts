import { istDate } from "./rules";

/**
 * Bus times. Each driver publishes when their bus leaves for each stretch and on which days it runs; travel
 * time is estimated from the distance at an average bus speed. A booking only chains buses that connect,
 * with time to change at the stand, so the shop gets a real ETA instead of a guess.
 */
export const BUS_KMPH = Number(process.env.BUS_KMPH ?? 40);
export const CHANGE_MINUTES = Number(process.env.CHANGE_MINUTES ?? 20);

/** One driver's bus on one stretch: departure "HH:MM" (India time) and days, Monday first ("1111110"). */
export type Timetable = { dep: string; days: string };
export type Candidate = { uid: string; tt: Timetable | null; away?: string[] };

export const legMinutes = (km: number) => Math.round((km / BUS_KMPH) * 60);

const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0

/** The first departure at or after `after`, on a day the bus runs and the driver is not away; null within a week otherwise. */
export function nextDeparture(tt: Timetable, after: Date, away: string[] = []): Date | null {
  if (!/^\d{2}:\d{2}$/.test(tt.dep)) return null;
  for (let d = 0; d < 8; d++) {
    const date = istDate(new Date(after.getTime() + d * 86_400_000));
    if (tt.days[weekday(date)] !== "1" || away.includes(date)) continue;
    const t = new Date(`${date}T${tt.dep}:00+05:30`);
    if (t >= after) return t;
  }
  return null;
}

export type Option = { uid: string; dep: Date | null; arr: Date | null };

/**
 * For each stretch in order, every candidate driver with their next connecting departure and arrival, earliest
 * arrival first (ties keep the given order, which is the drivers' record). Drivers without bus times come last
 * with no ETA. The next stretch is planned from the first option's arrival plus the change time.
 */
export function planStretches(stretches: { km: number; candidates: Candidate[] }[], readyAt: Date) {
  let at = readyAt;
  return stretches.map((st, i) => {
    const after = i === 0 ? at : new Date(at.getTime() + CHANGE_MINUTES * 60_000);
    const timed: Option[] = [];
    const untimed: Option[] = [];
    for (const c of st.candidates) {
      const dep = c.tt ? nextDeparture(c.tt, after, c.away ?? []) : null;
      if (dep) timed.push({ uid: c.uid, dep, arr: new Date(dep.getTime() + legMinutes(st.km) * 60_000) });
      else untimed.push({ uid: c.uid, dep: null, arr: null });
    }
    timed.sort((a, b) => a.arr!.getTime() - b.arr!.getTime());
    const options = [...timed, ...untimed];
    at = options[0]?.arr ?? new Date(after.getTime() + legMinutes(st.km) * 60_000);
    return { km: st.km, options };
  });
}

/** Departure and arrival for a route whose drivers are already chosen (the shop may pick other than the first). */
export function timesFor(stretches: { km: number; driver: Candidate }[], readyAt: Date) {
  let at = readyAt;
  return stretches.map((st, i) => {
    const after = i === 0 ? at : new Date(at.getTime() + CHANGE_MINUTES * 60_000);
    const dep = st.driver.tt ? nextDeparture(st.driver.tt, after, st.driver.away ?? []) : null;
    const arr = dep ? new Date(dep.getTime() + legMinutes(st.km) * 60_000) : null;
    at = arr ?? new Date(after.getTime() + legMinutes(st.km) * 60_000);
    return { dep, arr };
  });
}

/** Fits Arkiv's 128-byte str limit: "KNP-LKO@06:30/1111110,LKO-GKP@09:30/1111111". */
export const encodeTimetables = (t: Record<string, Timetable>) => Object.entries(t).map(([leg, v]) => `${leg}@${v.dep}/${v.days}`).join(",");
export function decodeTimetables(s?: string): Record<string, Timetable> {
  const out: Record<string, Timetable> = {};
  for (const part of (s ?? "").split(",").filter(Boolean)) {
    const m = part.match(/^([A-Z-]+)@(\d{2}:\d{2})\/([01]{7})$/);
    if (m) out[m[1]] = { dep: m[2], days: m[3] };
  }
  return out;
}

/** "16:00" today, "Sat 06:30" another day, in India time. */
export function clock(ms: number, now = new Date()) {
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...o }).format(new Date(ms));
  const hm = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return istDate(new Date(ms)) === istDate(now) ? hm : `${fmt({ weekday: "short" })} ${hm}`;
}

/** A stop is late once its ETA is more than this many minutes past and it has not been handed over. */
export const LATE_MINUTES = 30;
export const isLate = (etaAt: number | undefined | null, handed: boolean, now = Date.now()) => Boolean(etaAt && !handed && now > etaAt + LATE_MINUTES * 60_000);
