import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { chain } from "@/lib/hedera";
import { pageParams, parcelPage } from "@/lib/parcels";

/** The operator's list of parcels, a page at a time, with the count behind each filter. `?page=1&size=20&filter=attention&q=KNP` */
export async function GET(req: Request) {
  if (!isOperator(req)) return denied("operator");
  return NextResponse.json({ chain: chain(), ...(await parcelPage(pageParams(req.url))) });
}
