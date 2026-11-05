import { NextResponse } from "next/server";
import { denied, isOperator } from "@/lib/auth";
import { consignmentByCode, getBadge } from "@/lib/arkiv";
import { accountFor } from "@/lib/payout";
import { readLog } from "@/lib/history";
import { submitLog } from "@/lib/hedera";
import { unseal } from "@/lib/swarm";

/**
 * Until a licensed payout partner is connected, the operator pays each driver by UPI from the dashboard
 * (scan, pay) and types the bank's reference (UTR). Daak writes that UTR to the public log next to the
 * on-chain redemption, so "earned on chain" and "received in the bank" match line for line.
 */
export async function GET(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const c = await consignmentByCode(code);
  if (!c) return NextResponse.json({ error: "Unknown consignment" }, { status: 404 });
  const log = await readLog();
  const out = [];
  for (const l of c.route.filter((x) => (x.km ?? 0) > 0)) {
    const account = await accountFor(l.from);
    const cash = log.filter((m) => m.t === "daak.cashout" && m.code === code && m.driver === account);
    const rupees = Math.round(cash.reduce((s, m) => s + (m.rupees ?? 0), 0) * 100) / 100;
    const utr = log.filter((m) => m.t === "daak.upi" && m.code === code && m.driver === account).at(-1)?.utr ?? null;
    const b = await getBadge(l.from).catch(() => null);
    let vpa: string | null = null;
    try { vpa = b?.private ? JSON.parse(unseal(b.private, "person")).upi || null : null; } catch { vpa = null; }
    out.push({ hop: l.hop, account, name: b?.name ?? "Driver", vpa, rupees, utr });
  }
  return NextResponse.json({ code, drivers: out });
}

export async function POST(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const { code, account, rupees, utr } = (await req.json()) as { code: string; account: string; rupees: number; utr: string };
  if (!/^[A-Za-z0-9]{10,22}$/.test(utr ?? "")) return NextResponse.json({ error: "A UPI reference (UTR) is 12 digits, or 10 to 22 letters and digits" }, { status: 400 });
  const log = await submitLog({ t: "daak.upi", code, driver: account, rupees, utr, via: "operator UPI" });
  return NextResponse.json({ ok: true, hcs: log.txId });
}
