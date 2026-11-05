import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { OP_COOKIE, operatorToken } from "@/lib/auth";

/** The operator signs in with the passcode; a wrong one waits a second, so guessing is slow. */
export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const want = process.env.OPERATOR_PASSCODE ?? "";
  const h = (s: string) => createHash("sha256").update(s).digest();
  if (!want || !passcode || !timingSafeEqual(h(passcode), h(want))) {
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
