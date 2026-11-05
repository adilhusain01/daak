import { NextResponse, type NextRequest } from "next/server";

/** Sends anyone without the operator cookie to the sign-in page. The API routes check the cookie properly. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/ops/login")) return NextResponse.next();
  if (!req.cookies.get("daak_op")?.value) return NextResponse.redirect(new URL("/ops/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/ops/:path*"] };
