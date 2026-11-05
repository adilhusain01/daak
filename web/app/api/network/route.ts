import { NextResponse } from "next/server";
import { network, METER } from "@/lib/network";

/** The bus stands and stretches Daak runs, for the join and booking screens. */
export async function GET() {
  return NextResponse.json({ ...network(), meter: METER });
}
