import { allConsignments, allVerdicts, handoffsFor, type ConsignmentRow } from "./arkiv";
import { readLog, type LogMsg } from "./history";
import { accountFor } from "./payout";
import { weightSpec, paidFor } from "./network";
import { routeOnMap } from "./path";
import { holdbackStatus, isSplit } from "./split";
import { isPlaceholder } from "./standing";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

export type Filter = "all" | "attention" | "transit" | "paid";
export type StatusKey = "refunded" | "paid" | "releasing" | "held" | "review" | "transit";
export type Summary = {
  code: string; label: string; createdAt: number; feeRupees: number; paidRupees: number; km: number; weight: string;
  stops: number; handed: number; status: { key: StatusKey; text: string }; needsYou: boolean;
};

type Verdict = { code: string; hop: number; verdict: string; at: number };
const latestByHop = (hs: Verdict[]) => new Map([...hs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));

/**
 * A parcel's state for a list, from its stops' latest verdicts and the public log alone (no mirror-node calls):
 * a holdback schedule releases itself at its time unless a claim deleted it, and a claim is on the log.
 */
export function summarise(c: ConsignmentRow, verdicts: Verdict[], log: LogMsg[], now = Date.now()): Summary {
  const latest = latestByHop(verdicts.filter((v) => v.code === c.code));
  const values = [...latest.values()];
  const mine = log.filter((m) => m.code === c.code);
  const holdback = mine.filter((m) => m.t === "daak.holdback").at(-1) as (LogMsg & { releasesAt?: number }) | undefined;
  const refunded = mine.some((m) => m.t === "daak.refunded");
  const paidOld = !isSplit(c) && mine.some((m) => m.t === "daak.reviewed" || (m.t === "daak.resolved" && (m as { action?: string }).action === "pay"));
  const status: Summary["status"] =
    refunded ? { key: "refunded", text: "Claim settled, shop refunded" }
    : holdback && holdback.releasesAt && holdback.releasesAt <= now ? { key: "paid", text: "Delivered, drivers paid in full" }
    : holdback ? { key: "releasing", text: "Delivered, held pay releasing" }
    : paidOld ? { key: "paid", text: "Delivered, drivers paid" }
    : values.includes("held") ? { key: "held", text: "Payment held" }
    : latest.size === c.route.length && values.includes("unchecked") ? { key: "review", text: "Delivered, waiting for review" }
    : { key: "transit", text: `On the way, ${latest.size} of ${c.route.length} stops` };
  const done = ["refunded", "paid", "releasing"].includes(status.key);
  // Split payout: each unchecked stop can be approved as it comes in; older bookings only once every stop is in.
  const needsYou = !done && (values.includes("held") || (isSplit(c) ? values.includes("unchecked") : status.key === "review"));
  return {
    code: c.code, label: c.label, createdAt: c.createdAt, feeRupees: c.feeRupees, paidRupees: paidFor(c.feeRupees), km: c.route.reduce((s, l) => s + (l.km ?? 0), 0),
    weight: weightSpec(c.weight ?? "s").label, stops: c.route.length, handed: latest.size, status, needsYou,
  };
}

const done = (s: Summary) => ["paid", "releasing", "refunded"].includes(s.status.key);
/** The public has no "needs the operator" queue: everything not delivered is on the way. */
const inFilter = (s: Summary, f: Filter, publicView = false) =>
  f === "all" ? true : f === "attention" ? s.needsYou : f === "paid" ? done(s) : !done(s) && (publicView || !s.needsYou);

/** One page of parcels with the count behind every filter, worked out on the server. */
export async function parcelPage(opts: { page: number; size: number; filter: Filter; q?: string; publicOnly?: boolean; who?: string }) {
  const since = Number(process.env.DATA_SINCE ?? 0);
  const [all, verdicts, log] = await Promise.all([allConsignments(since), allVerdicts(), readLog()]);
  // `who`: only the parcels this badge sends, carries or receives (the app's own list).
  const list = all.filter((c) => (!opts.publicOnly || !isPlaceholder(c.parcel)) && (!opts.who || c.route.some((l) => l.from === opts.who || l.to === opts.who)))
    .map((c) => summarise(c, verdicts, log));
  const q = opts.q?.trim().toUpperCase();
  const searched = q ? list.filter((s) => s.code.includes(q) || s.label.toUpperCase().includes(q)) : list;
  const counts = { all: searched.length, attention: 0, transit: 0, paid: 0 } as Record<Filter, number>;
  for (const s of searched) for (const f of ["attention", "transit", "paid"] as Filter[]) if (inFilter(s, f, opts.publicOnly || Boolean(opts.who))) counts[f]++;
  const rows = searched.filter((s) => inFilter(s, opts.filter, opts.publicOnly || Boolean(opts.who)));
  const size = Math.min(Math.max(opts.size, 5), 100);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, opts.page), pages);
  return { counts, total: rows.length, page, pages, size, rows: rows.slice((page - 1) * size, page * size) };
}

export function pageParams(url: string) {
  const u = new URL(url).searchParams;
  const f = u.get("filter") as Filter | null;
  return { page: Number(u.get("page") ?? 1) || 1, size: Number(u.get("size") ?? 20) || 20, filter: (["all", "attention", "transit", "paid"] as Filter[]).includes(f!) ? f! : "all", q: u.get("q") ?? undefined };
}

async function paidAt(schedule?: string) {
  if (!schedule) return null;
  const r = await fetch(`${MIRROR}/schedules/${schedule}`, { cache: "no-store" });
  if (!r.ok) return null;
  const ts = (await r.json()).executed_timestamp as string | null;
  return ts ? Math.round(Number(ts) * 1000) : null;
}

/** Everything the operator sees for one parcel: stops, photos, money per driver, holdbacks. */
/** The route along the road and where the parcel is, as the customer tracking page draws it. */
const mapOf = (c: ConsignmentRow, handoffs: { hop: number; verdict: string }[]) =>
  routeOnMap(c.route, new Set(handoffs.filter((h) => h.verdict !== "held").map((h) => h.hop)));

export async function operatorDetail(c: ConsignmentRow, log?: LogMsg[]) {
  log ??= await readLog();
  const drivers = await Promise.all(c.route.map(async (l) => ({ hop: l.hop, badge: l.from, account: await accountFor(l.from) })));
  const money = drivers.map((d) => {
    const cash = log.filter((m) => m.t === "daak.cashout" && m.code === c.code && m.driver === d.account);
    const saved = log.filter((m) => m.t === "daak.bachat" && m.code === c.code && m.driver === d.account);
    const adv = log.filter((m) => m.t === "daak.advance" && m.code === c.code && m.hop === d.hop).at(-1) as (LogMsg & { pct?: number; heldRupees?: number }) | undefined;
    return {
      hop: d.hop, account: d.account,
      answer: (log.filter((m) => m.t === "daak.job" && m.code === c.code && m.hop === d.hop).at(-1) as { decision?: string } | undefined)?.decision ?? null,
      advanceRupees: adv?.rupees ?? 0, advancePct: adv?.pct ?? c.route.find((l) => l.hop === d.hop)?.advancePct ?? null, heldRupees: adv?.heldRupees ?? null,
      upiRupees: cash.reduce((s, m) => s + (m.rupees ?? 0), 0), upiStatus: cash.at(-1)?.status ?? null, utr: cash.at(-1)?.utr ?? null,
      bachatRupees: saved.reduce((s, m) => s + (m.saved ?? 0), 0),
    };
  });
  const km = c.route.reduce((s, l) => s + (l.km ?? 0), 0);
  const meter = `Rs 5 + Rs 0.50 a km, ${weightSpec(c.weight ?? "s").label} (x${weightSpec(c.weight ?? "s").factor})`;
  // Badges never leave the server; the photo only as "there is one".
  const handoffs = (await handoffsFor(c.code)).map(({ photo, fromBadge: _f, toBadge: _t, ...h }) => ({ ...h, hasPhoto: Boolean(photo) }));
  if (isSplit(c)) {
    const holdback = await holdbackStatus(c.code, log);
    const scheduledAt = log.find((m) => m.t === "daak.holdback" && m.code === c.code)?.ts ?? null;
    return { ...c, paidRupees: paidFor(c.feeRupees), km, meter, handoffs, money, holdback, map: mapOf(c, handoffs), paidAt: holdback && !holdback.deleted ? scheduledAt : null };
  }
  return { ...c, paidRupees: paidFor(c.feeRupees), km, meter, handoffs, money, holdback: null, map: mapOf(c, handoffs), paidAt: await paidAt(c.schedule) };
}

/** The public view of one parcel: no photos, badges, phone, UPI or bank details. */
export async function publicDetail(c: ConsignmentRow, log?: LogMsg[]) {
  log ??= await readLog();
  const handoffs = (await handoffsFor(c.code)).map((h) => ({ key: h.key, hop: h.hop, verdict: h.verdict, place: h.place, at: h.at, reason: h.reason, hcs: h.hcs, zgRequestId: h.zgRequestId }));
  const money = c.route.filter((l) => (l.km ?? 0) > 0).map((l) => {
    const adv = log.filter((m) => m.t === "daak.advance" && m.code === c.code && m.hop === l.hop).at(-1) as (LogMsg & { pct?: number; heldRupees?: number; tx?: string }) | undefined;
    const answer = (log.filter((m) => m.t === "daak.job" && m.code === c.code && m.hop === l.hop).at(-1) as { decision?: string } | undefined)?.decision ?? null;
    return { hop: l.hop, km: l.km, pct: l.advancePct ?? null, advanceRupees: adv?.rupees ?? 0, heldRupees: adv?.heldRupees ?? null, tx: adv?.tx ?? null, answer };
  });
  const { status } = summarise(c, handoffs.map((h) => ({ code: c.code, hop: h.hop, verdict: h.verdict, at: h.at })), log);
  return {
    code: c.code, label: c.label, createdAt: c.createdAt, feeRupees: c.feeRupees, paidRupees: paidFor(c.feeRupees), weight: weightSpec(c.weight ?? "s").label, status,
    km: c.route.reduce((s, l) => s + (l.km ?? 0), 0), route: c.route.map((l) => ({ hop: l.hop, place: l.place, km: l.km ?? 0, departsAt: l.departsAt ?? null, etaAt: l.etaAt ?? null })),
    handoffs, money, holdback: isSplit(c) ? await holdbackStatus(c.code, log) : null, map: mapOf(c, handoffs),
  };
}
