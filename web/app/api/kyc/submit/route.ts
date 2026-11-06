import { denied, isApp } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getBadge, setKyc } from "@/lib/arkiv";
import { logHandoff } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";
import { verifyHandoff } from "@/lib/signing";
import { seal, sealRef, uploadPhoto } from "@/lib/swarm";

const ID_TYPES = ["dl", "voter", "aadhaar_masked"];

/**
 * A driver who joined before the ID check adds their government ID from the app. It must be signed by the phone
 * registered to that badge, and works only while no ID is on file (or after the operator rejected one).
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { uid, idType, idLast4, idPhoto, sig } = (await req.json()) as { uid: string; idType: string; idLast4: string; idPhoto: string; sig: string };
  const b = await getBadge(uid).catch(() => null);
  if (!b || b.role !== "driver") return NextResponse.json({ error: "Only a driver who has joined can add an ID" }, { status: 400 });
  if (b.kyc && b.kycStatus !== "rejected") return NextResponse.json({ error: "An ID is already on file. Ask Daak to change it." }, { status: 409 });
  if (!ID_TYPES.includes(idType) || !/^[A-Z0-9]{4}$/i.test(idLast4 ?? "")) return NextResponse.json({ error: "Choose the ID and enter its last 4 characters" }, { status: 400 });
  const photo = Buffer.from(idPhoto ?? "", "base64");
  if (photo.length < 10_000 || photo.length > 3_000_000) return NextResponse.json({ error: "Take a clear photo of the ID" }, { status: 400 });
  const sha = createHash("sha256").update(photo).digest("hex");
  if (!b.devicePub || !sig || !verifyHandoff(b.devicePub, `daak.kyc|${uid}|${sha}`, sig)) {
    return NextResponse.json({ error: "This must come from the phone registered to this badge" }, { status: 401 });
  }
  const ref = sealRef(await uploadPhoto(photo));
  const kyc = seal(JSON.stringify({ idType, last4: idLast4.toUpperCase(), photo: ref, at: Date.now() }), "kyc");
  const arkiv = await setKyc(uid, kyc);
  await logHandoff({ t: "daak.kyc", id: badgeHash(uid), status: "pending", idType });
  return NextResponse.json({ ok: true, status: "pending", arkiv });
}
