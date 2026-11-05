import { NextResponse } from "next/server";
import { readLog } from "@/lib/history";
import { chain } from "@/lib/hedera";

let cache: { at: number; body: object } | null = null;

/** Live numbers for the landing page, counted straight from the public Hedera log. */
export async function GET() {
  if (cache && Date.now() - cache.at < 30_000) return NextResponse.json(cache.body);
  const since = Number(process.env.DATA_SINCE ?? 0);
  const log = (await readLog()).filter((m) => m.ts >= since);
  const handoffs = log.filter((m) => m.t === "daak.handoff");
  const body = {
    topicId: chain().topicId,
    tokenId: chain().feeTokenId,
    bookings: log.filter((m) => m.t === "daak.booked").length,
    handoffs: handoffs.length,
    km: handoffs.reduce((s, m) => s + (m.km ?? 0), 0),
    paidOut: log.filter((m) => m.t === "daak.cashout").reduce((s, m) => s + (m.rupees ?? 0), 0),
    people: log.filter((m) => m.t === "daak.joined").length,
    last: log.at(-1)?.ts ?? null,
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
