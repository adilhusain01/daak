import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { runDue } from "@/lib/standing";

/** Vercel Cron calls this with CRON_SECRET at 04:00 IST; the operator can also run it from the dashboard. */
const allowed = (req: Request) =>
  isOperator(req) || (Boolean(process.env.CRON_SECRET) && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);

async function run(req: Request) {
  if (!allowed(req)) return denied("operator");
  return NextResponse.json(await runDue(new URL(req.url).origin));
}

export const GET = run;
export const POST = run;
