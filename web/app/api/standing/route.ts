import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge, standingOrders } from "@/lib/arkiv";
import { createStanding, waitingToday } from "@/lib/standing";

const name = async (uid: string) => (await getBadge(uid).catch(() => null))?.name.split(",")[0] ?? uid.slice(-6);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayText = (d: string) => (d === "1111111" ? "Every day" : d === "1111110" ? "Monday to Saturday" : d === "1111100" ? "Monday to Friday" : DAYS.filter((_, i) => d[i] === "1").join(", "));

/** A shop's standing orders (the app), or every shop's (the operator), with today's booking. */
export async function GET(req: Request) {
  const sender = new URL(req.url).searchParams.get("sender");
  if (sender ? !isApp(req) : !isOperator(req)) return denied(sender ? "app" : "operator");
  const list = await standingOrders(sender ?? undefined);
  const waiting = sender ? await waitingToday(sender) : null;
  return NextResponse.json({
    orders: await Promise.all(list.map(async (o) => ({
      id: o.id, sender: await name(o.sender), receiver: await name(o.receiver), drivers: await Promise.all(o.drivers.map(name)),
      days: o.days, daysText: dayText(o.days), active: o.active, lastRun: o.lastRun || null, lastCode: o.lastCode || null,
    }))),
    waiting: waiting && { code: waiting.code, receiver: waiting.receiverName },
  });
}

/** The shop makes a booking repeat on chosen weekdays. */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const b = (await req.json()) as { sender: string; receiver: string; drivers: string[]; days?: string };
  try {
    return NextResponse.json({ ok: true, ...(await createStanding({ sender: b.sender, receiver: b.receiver, drivers: b.drivers ?? [], days: b.days ?? "1111110" })) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
