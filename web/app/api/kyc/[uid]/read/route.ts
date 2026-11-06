import { NextResponse } from "next/server";
import { denied, isOperator } from "@/lib/auth";
import { getBadge } from "@/lib/arkiv";
import { downloadPhoto, openRef, unseal } from "@/lib/swarm";
import { askSealed } from "@/lib/zg";
import { compareId, type IdReading } from "@/lib/rules";
import { submitLog } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";

const PROMPT =
  `This is a photo of an Indian government ID: a driving licence, a voter ID, or an Aadhaar card whose first 8 digits ` +
  `should be covered. Read it and answer only with JSON: {"doc_type": "dl" | "voter" | "aadhaar_masked" | "other" | "unclear", ` +
  `"name": string (the holder's name as printed), "last4": string (the last 4 characters of the ID number), ` +
  `"vehicle_classes": string (for a driving licence, the classes of vehicle as printed, else ""), ` +
  `"masked": boolean (true if the first 8 digits of an Aadhaar number are hidden), ` +
  `"edited": boolean (true if text looks pasted, retyped or digitally changed), "notes": string (one short sentence)}.`;

/**
 * 0G reads a driver's ID photo inside a sealed machine and Daak compares it with what the driver claimed. The operator
 * sees the reading; the public log gets only the 0G receipt and which checks passed, never the name or the number.
 */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  if (!isOperator(req)) return denied("operator");
  const uid = decodeURIComponent((await ctx.params).uid);
  const b = await getBadge(uid);
  if (!b?.kyc) return NextResponse.json({ error: "No ID on file" }, { status: 404 });
  const claimed = JSON.parse(unseal(b.kyc, "kyc")) as { idType: string; last4: string; photo: string };
  const photo = Buffer.from(await downloadPhoto(openRef(claimed.photo)));
  let r: Awaited<ReturnType<typeof askSealed>>;
  try { r = await askSealed(photo, PROMPT); } catch (e) { return NextResponse.json({ error: `0G did not answer: ${(e as Error).message.slice(0, 120)}` }, { status: 503 }); }
  let j: Record<string, unknown>;
  try { j = JSON.parse(r.content.slice(r.content.indexOf("{"), r.content.lastIndexOf("}") + 1)); } catch { return NextResponse.json({ error: "0G's answer could not be read", raw: r.content.slice(0, 200) }, { status: 502 }); }
  const read: IdReading = {
    docType: String(j.doc_type ?? "unclear"), name: String(j.name ?? ""), last4: String(j.last4 ?? ""),
    vehicleClasses: String(j.vehicle_classes ?? ""), masked: j.masked === true, edited: j.edited === true,
  };
  const checks = compareId(read, { idType: claimed.idType, name: b.name, last4: claimed.last4 });
  await submitLog({ t: "daak.kyc.read", id: badgeHash(uid), zg: r.requestId ?? null, checks }).catch(() => null);
  return NextResponse.json({ read, notes: String(j.notes ?? ""), checks, requestId: r.requestId, model: r.model });
}
