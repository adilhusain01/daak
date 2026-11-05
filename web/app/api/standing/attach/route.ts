import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { attachToday } from "@/lib/standing";

/** The shop taps today's parcel for a daily order that Daak already booked and paid this morning. */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { sender, parcel } = (await req.json()) as { sender: string; parcel: string };
  if (!sender || !parcel) return NextResponse.json({ error: "Need the shop and the parcel" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await attachToday(sender, parcel)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
