import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { workHistory } from "@/lib/history";
import { decodeTimetables } from "@/lib/timetable";
import { istDate } from "@/lib/rules";
import { getBadge, getPrefs, putPrefs } from "@/lib/arkiv";

/** A driver's screen: proven work, earnings, Bachat and the advance it unlocks. */
export async function GET(_req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(_req) && !isOperator(_req)) return denied("app");
  const { uid } = await ctx.params;
  const id = decodeURIComponent(uid);
  const [history, prefs, badge] = await Promise.all([workHistory(id), getPrefs(id).catch(() => ({ savePercent: 0 })), getBadge(id).catch(() => null)]);
  return NextResponse.json({
    uid: id, name: badge?.name ?? null, ...history, savePercent: prefs.savePercent,
    legs: badge?.legs ?? [], timetable: decodeTimetables(badge?.timetable), awayToday: (badge?.away ?? []).includes(istDate()),
    idStatus: badge?.kycStatus ?? (badge?.kyc ? "pending" : "missing"),
  });
}

/** The driver opts in or out of Bachat (0 to 20% of each payout). */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isApp(req)) return denied("app");
  const { uid } = await ctx.params;
  const { savePercent } = (await req.json()) as { savePercent: number };
  const pct = Math.max(0, Math.min(20, Math.round(Number(savePercent) || 0)));
  const r = await putPrefs(decodeURIComponent(uid), pct);
  return NextResponse.json({ savePercent: pct, arkiv: r });
}
