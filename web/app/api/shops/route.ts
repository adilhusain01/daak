import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { badgesByRole } from "@/lib/arkiv";
import { shopBalance } from "@/lib/shop";
import { stopName } from "@/lib/network";

/** Every sending shop with its prepaid balance, for the operator. */
export async function GET(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const shops = await badgesByRole("sender");
  return NextResponse.json({
    shops: await Promise.all(shops.map(async (s) => ({ uid: s.uid, name: s.name, stand: s.stop ? stopName(s.stop) : null, ...(await shopBalance(s.uid)) }))),
  });
}
