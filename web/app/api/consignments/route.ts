import { NextResponse } from "next/server";
import { recentConsignments, handoffsFor } from "@/lib/arkiv";
import { chain } from "@/lib/hedera";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

async function paidAt(schedule?: string) {
  if (!schedule) return null;
  const r = await fetch(`${MIRROR}/schedules/${schedule}`, { cache: "no-store" });
  if (!r.ok) return null;
  const ts = (await r.json()).executed_timestamp as string | null;
  return ts ? Math.round(Number(ts) * 1000) : null;
}

/** Everything the operator dashboard shows, read from Arkiv and Hedera's mirror node. */
export async function GET() {
  const list = await recentConsignments();
  const rows = await Promise.all(
    list.map(async (c) => ({ ...c, handoffs: await handoffsFor(c.code), paidAt: await paidAt(c.schedule) })),
  );
  return NextResponse.json({ chain: chain(), consignments: rows });
}
