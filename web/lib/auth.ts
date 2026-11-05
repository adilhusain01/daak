import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Two kinds of caller may change things: the operator (a passcode, kept as an httpOnly cookie) and the
 * Daak phone app (a key built into the app). Everything that moves money, reveals a photo or a person's
 * details checks one of these inside the route itself; the proxy only redirects pages.
 */
export const OP_COOKIE = "daak_op";

export function operatorToken(): string {
  return createHash("sha256").update(`operator:${process.env.OPERATOR_PASSCODE ?? ""}:${process.env.DAAK_MASTER_SECRET ?? ""}`).digest("hex");
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function cookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const hit = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export function isOperator(req: Request): boolean {
  const c = cookie(req, OP_COOKIE);
  return Boolean(process.env.OPERATOR_PASSCODE) && c !== null && same(c, operatorToken());
}

export function isApp(req: Request): boolean {
  const k = req.headers.get("x-daak-app") ?? "";
  const want = process.env.DAAK_APP_KEY ?? "";
  return (want.length > 0 && same(k, want)) || isOperator(req);
}

export const denied = (who: "operator" | "app") =>
  NextResponse.json({ error: who === "operator" ? "Operator sign-in needed" : "Only the Daak app can do this" }, { status: 401 });
