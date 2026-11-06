import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { consignmentByCode } from "@/lib/arkiv";
import { chain } from "@/lib/hedera";
import { operatorDetail } from "@/lib/parcels";

/** Everything the operator sees for one parcel. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isOperator(req)) return denied("operator");
  const c = await consignmentByCode(decodeURIComponent((await params).code).toUpperCase());
  if (!c) return NextResponse.json({ error: "No parcel with that code" }, { status: 404 });
  return NextResponse.json({ chain: chain(), parcel: await operatorDetail(c) });
}
