import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { agentBook } from "@/lib/agent";
import { recentConsignments, type Leg } from "@/lib/arkiv";
import { buildRoute } from "@/lib/booking";
import { measure, weightSpec } from "@/lib/network";

/**
 * The shop books a parcel: from its own bus stand to the receiver's, with one chosen driver per stretch.
 * The first handoff is the pickup at the shop's stand (shop to the first driver, 0 km); each later handoff
 * pays its giver for the stretch they carried. The shop's agent then pays for the booking over x402.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const body = (await req.json()) as {
    parcel: string; sender?: string; receiver?: string; drivers?: string[]; weight?: string;
    kg?: number; lengthCm?: number; widthCm?: number; heightCm?: number;
  };
  if (!body.parcel) return NextResponse.json({ error: "Tap a parcel first" }, { status: 400 });
  // A measured parcel: the server works out the band from the weight and the sides, whatever the app showed.
  // An older app still sends a band.
  if (body.kg != null || body.lengthCm != null) {
    const m = measure({ kg: Number(body.kg), lengthCm: Number(body.lengthCm), widthCm: Number(body.widthCm), heightCm: Number(body.heightCm) });
    if ("error" in m) return NextResponse.json({ error: m.error }, { status: 400 });
    body.weight = m.spec; // priced on every charged kg, so each driver's pay follows the parcel
  }
  try { weightSpec(body.weight ?? "s"); } catch { return NextResponse.json({ error: "Enter the parcel's weight and size" }, { status: 400 }); }
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
    return NextResponse.json({ error: "Choose the receiver and a driver for each stretch" }, { status: 400 });
  }
  try {
    const booked = await agentBook(origin, { parcel: body.parcel, label, route, weight: body.weight }, body.sender);
    return NextResponse.json({ ...booked, trackUrl: `${origin}/track/${booked.code}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
