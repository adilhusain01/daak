import { denied, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { badgesByRole, setKycStatus } from "@/lib/arkiv";
import { unseal } from "@/lib/swarm";
import { submitLog } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";

const ID_NAMES: Record<string, string> = { dl: "Driving licence", voter: "Voter ID", aadhaar_masked: "Masked Aadhaar" };

/** Drivers and their ID check, for the operator. Shows the ID type and last 4 only; the photo opens separately. */
export async function GET(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const drivers = await badgesByRole("driver");
  return NextResponse.json({
    drivers: drivers.map((d) => {
      let id: { idType?: string; last4?: string; at?: number } = {};
      try { if (d.kyc) id = JSON.parse(unseal(d.kyc, "kyc")); } catch { /* unreadable: treat as missing */ }
      return { uid: d.uid, name: d.name, vehicle: d.vehicle, status: d.kycStatus ?? (d.kyc ? "pending" : "missing"), idType: id.idType ? ID_NAMES[id.idType] ?? id.idType : null, last4: id.last4 ?? null, at: id.at ?? null };
    }),
  });
}

/** The operator verifies or rejects a driver's ID after looking at the photo. The decision goes on the public log by badge hash. */
export async function POST(req: Request) {
  if (!isOperator(req)) return denied("operator");
  const { uid, status, reviewer } = (await req.json()) as { uid: string; status: "verified" | "rejected"; reviewer?: string };
  if (!uid || !["verified", "rejected"].includes(status)) return NextResponse.json({ error: "Need uid and status" }, { status: 400 });
  const arkiv = await setKycStatus(uid, status);
  const log = await submitLog({ t: "daak.kyc", id: badgeHash(uid), status, reviewer: reviewer ?? "operator" });
  return NextResponse.json({ ok: true, status, arkiv, hcs: log.txId });
}
