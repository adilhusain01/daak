import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { OP_COOKIE, operatorToken } from "@/lib/auth";
import { loginAllowed } from "@/lib/rules";

/** Wrong tries per address, kept in this server instance (each instance limits on its own). */
const failures = new Map<string, number[]>();

/** The operator signs in with the passcode; a wrong one waits a second, and 5 wrong tries lock that address for 15 minutes. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const tries = (failures.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  if (!loginAllowed(tries, now)) return NextResponse.json({ ok: false, error: "Too many wrong tries. Wait 15 minutes." }, { status: 429 });
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const want = process.env.OPERATOR_PASSCODE ?? "";
  const h = (s: string) => createHash("sha256").update(s).digest();
  if (!want || !passcode || !timingSafeEqual(h(passcode), h(want))) {
    failures.set(ip, [...tries, now]);
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ ok: false, error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OP_COOKIE, operatorToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 3 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(OP_COOKIE);
  return res;
}
