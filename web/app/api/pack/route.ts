import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agentBook } from "@/lib/agent";

/**
 * The shop taps a new parcel. The shop's agent books and pays for the delivery over x402,
 * and the phone gets back the tracking link to write onto the parcel's tag.
 */
export async function POST(req: Request) {
  const { parcel } = (await req.json()) as { parcel: string };
  if (!parcel) return NextResponse.json({ error: "Tap a parcel first" }, { status: 400 });
  const demo = JSON.parse(readFileSync(path.join(process.cwd(), "data", "demo-route.json"), "utf8"));
  const origin = new URL(req.url).origin;
  try {
    const booked = await agentBook(origin, { parcel, ...demo });
    return NextResponse.json({ ...booked, trackUrl: `${origin}/track/${booked.code}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
