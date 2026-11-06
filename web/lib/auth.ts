import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Two kinds of caller may change things: the operator (a passcode, kept as an httpOnly cookie) and the
 * Daak phone app (a key built into the app). Everything that moves money, reveals a photo or a person's
 * details checks one of these inside the route itself; the proxy only redirects pages.
 */
export const OP_COOKIE = "daak_op";

/** How long an operator sign-in lasts. */
export const OP_SESSION_MS = 3 * 86_400_000;

const sessionMac = (issuedAt: number) =>
  createHmac("sha256", `${process.env.DAAK_MASTER_SECRET ?? ""}`).update(`operator:${issuedAt}:${process.env.OPERATOR_PASSCODE ?? ""}`).digest("hex");

/** A new operator session, "issuedAt.mac": signed with the server secret, tied to the passcode, expiring after 3 days. */
export function operatorToken(now = Date.now()): string {
  return `${now}.${sessionMac(now)}`;
}

/** True for a session this server issued, not altered, not expired, under the current passcode. */
export function verifyOperatorToken(token: string, now = Date.now()): boolean {
  const [at, mac] = token.split(".");
  const issuedAt = Number(at);
  if (!Number.isFinite(issuedAt) || !mac || now - issuedAt > OP_SESSION_MS || issuedAt - now > 60_000) return false;
  return same(mac, sessionMac(issuedAt));
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const hit = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export function isOperator(req: Request): boolean {
  const c = cookie(req, OP_COOKIE);
  return Boolean(process.env.OPERATOR_PASSCODE) && c !== null && verifyOperatorToken(c);
}

export function isApp(req: Request): boolean {
  const k = req.headers.get("x-daak-app") ?? "";
  const want = process.env.DAAK_APP_KEY ?? "";
  return (want.length > 0 && same(k, want)) || isOperator(req);
}

export const denied = (who: "operator" | "app") =>
  NextResponse.json({ error: who === "operator" ? "Operator sign-in needed" : "Only the Daak app can do this" }, { status: 401 });
