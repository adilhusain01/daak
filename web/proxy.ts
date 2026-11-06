import { NextResponse, type NextRequest } from "next/server";
import { OP_COOKIE, verifyOperatorToken } from "@/lib/auth";

/** Sends anyone without a valid operator session (missing, altered, expired, or from before the passcode changed) to the sign-in page. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/ops/login")) return NextResponse.next();
  const c = req.cookies.get(OP_COOKIE)?.value;
  if (!c || !verifyOperatorToken(c)) {
    const res = NextResponse.redirect(new URL("/ops/login", req.url));
    res.cookies.delete(OP_COOKIE);
    return res;
  }
  return NextResponse.next();
}

export const config = { matcher: ["/ops/:path*"] };
