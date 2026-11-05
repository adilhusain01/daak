import { NextResponse } from "next/server";
import { badgesByRole } from "@/lib/arkiv";
import { stopName } from "@/lib/network";

/** Shops and stores a parcel can be sent to, with their bus stand. */
export async function GET() {
  const rs = await badgesByRole("receiver");
  return NextResponse.json({ receivers: rs.filter((r) => r.stop).map((r) => ({ uid: r.uid, name: r.name, stop: r.stop, stopName: stopName(r.stop!) })) });
}
