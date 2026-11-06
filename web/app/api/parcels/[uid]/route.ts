import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { pageParams, parcelPage } from "@/lib/parcels";

/** The app's "My parcels": every parcel this badge sends, carries or receives, newest first, a page at a time. */
export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  if (!isApp(req) && !isOperator(req)) return denied("app");
  const who = decodeURIComponent((await params).uid);
  const { counts: _c, ...page } = await parcelPage({ ...pageParams(req.url), who });
  return NextResponse.json({ ...page, rows: page.rows.map(({ needsYou: _n, ...r }) => r) });
}
