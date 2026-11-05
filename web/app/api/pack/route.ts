import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agentBook } from "@/lib/agent";
import { recentConsignments, type Leg } from "@/lib/arkiv";
import { buildRoute } from "@/lib/booking";

/**
 * The shop books a parcel: from its own bus stand to the receiver's, with one chosen driver per stretch.
 * The first handoff is the pickup at the shop's stand (shop to the first driver, 0 km); each later handoff
 * pays its giver for the stretch they carried. The shop's agent then pays for the booking over x402.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const body = (await req.json()) as { parcel: string; sender?: string; receiver?: string; drivers?: string[] };
  if (!body.parcel) return NextResponse.json({ error: "Tap a parcel first" }, { status: 400 });
  // A cap so a leaked app key cannot make Daak's agent spend without limit.
  const cap = Number(process.env.BOOKINGS_PER_HOUR ?? 12);
  const lastHour = (await recentConsignments()).filter((c) => c.createdAt > Date.now() - 3600_000).length;
  if (lastHour >= cap) return NextResponse.json({ error: `Booking limit reached (${cap} an hour). Try again later.` }, { status: 429 });
  const origin = new URL(req.url).origin;

  let route: Leg[];
  let label: string;
  if (body.sender && body.receiver && body.drivers?.length) {
    const built = await buildRoute(body.sender, body.receiver, body.drivers);
    if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });
    ({ route, label } = built);
  } else {
    // The fixed demo route, kept for the scripts and for shops booking before receivers have joined.
    const demo = JSON.parse(readFileSync(path.join(process.cwd(), "data", "demo-route.json"), "utf8"));
    route = demo.route;
    label = demo.label;
  }
  try {
    const booked = await agentBook(origin, { parcel: body.parcel, label, route });
    return NextResponse.json({ ...booked, trackUrl: `${origin}/track/${booked.code}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
