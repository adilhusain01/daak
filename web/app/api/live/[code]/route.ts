import { NextResponse } from "next/server";
import { consignmentByCode } from "@/lib/arkiv";
import { chain } from "@/lib/hedera";
import { publicDetail } from "@/lib/parcels";
import { isPlaceholder } from "@/lib/standing";

/** One delivery, public and read-only: stops, verdicts, money per stretch and the proof links. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = await consignmentByCode(decodeURIComponent((await params).code).toUpperCase());
  if (!c || isPlaceholder(c.parcel) || c.createdAt < Number(process.env.DATA_SINCE ?? 0)) return NextResponse.json({ error: "No delivery with that code" }, { status: 404 });
  return NextResponse.json({ chain: chain(), delivery: await publicDetail(c) }, { headers: { "Cache-Control": "public, s-maxage=20" } });
}
