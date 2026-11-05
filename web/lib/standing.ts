import { randomUUID } from "node:crypto";
import { agentBook } from "./agent";
import { attachParcel, consignmentByCode, getBadge, patchStanding, putStanding, standingOrders, type StandingRow } from "./arkiv";
import { buildRoute } from "./booking";
import { logHandoff } from "./hedera";
import { badgeHash } from "./history";
import { istDate, standingDue } from "./rules";

/** The tag a standing order's booking carries until the shop taps that day's real parcel. */
export const placeholder = (id: string, date: string) => `daily:${id}:${date}`;
export const isPlaceholder = (parcel: string) => parcel.startsWith("daily:");

export async function createStanding(o: { sender: string; receiver: string; drivers: string[]; days: string }) {
  if (!/^[01]{7}$/.test(o.days) || !o.days.includes("1")) throw new Error("Choose at least one weekday");
  const built = await buildRoute(o.sender, o.receiver, o.drivers);
  if ("error" in built) throw new Error(built.error);
  const id = randomUUID().slice(0, 8);
  const arkiv = await putStanding({ id, ...o });
  const km = built.route.reduce((s, l) => s + (l.km ?? 0), 0);
  const hcs = await logHandoff({ t: "daak.standing", id, sender: badgeHash(o.sender), days: o.days, km });
  return { id, arkiv, hcs, label: built.label };
}

/**
 * Books every standing order due today: Daak's agent pays each over x402 like any booking, so the drivers
 * see the parcel on their to-do list before the shop has even packed it.
 */
export async function runDue(origin: string, now = new Date()) {
  const today = istDate(now);
  const due = (await standingOrders()).filter((o) => o.active && standingDue(o, now));
  const out = [];
  for (const o of due) {
    try {
      const built = await buildRoute(o.sender, o.receiver, o.drivers);
      if ("error" in built) throw new Error(built.error);
      const booked = await agentBook(origin, { parcel: placeholder(o.id, today), label: `Daily: ${built.label.replace(/^Parcel from /, "")}`, route: built.route });
      await patchStanding(o.key, { lastRun: today, lastCode: booked.code });
      await logHandoff({ t: "daak.standing.booked", id: o.id, code: booked.code, date: today });
      out.push({ id: o.id, code: booked.code });
    } catch (e) {
      out.push({ id: o.id, error: (e as Error).message.slice(0, 160) });
    }
  }
  return { date: today, due: due.length, booked: out };
}

/** Today's booking of a shop's standing order that still waits for its parcel, if any. */
export async function waitingToday(sender: string, now = new Date()): Promise<{ order: StandingRow; code: string; receiverName: string } | null> {
  const today = istDate(now);
  for (const o of await standingOrders(sender)) {
    if (o.lastRun !== today || !o.lastCode) continue;
    const c = await consignmentByCode(o.lastCode);
    if (c && isPlaceholder(c.parcel)) return { order: o, code: o.lastCode, receiverName: (await getBadge(o.receiver).catch(() => null))?.name.split(",")[0] ?? "the receiver" };
  }
  return null;
}

/** The shop taps today's parcel: it takes the place of the placeholder on the paid booking. */
export async function attachToday(sender: string, parcel: string) {
  const w = await waitingToday(sender);
  if (!w) throw new Error("No daily order is waiting for a parcel today");
  const arkiv = await attachParcel(w.code, parcel);
  await logHandoff({ t: "daak.standing.attached", id: w.order.id, code: w.code });
  return { code: w.code, receiverName: w.receiverName, arkiv };
}
