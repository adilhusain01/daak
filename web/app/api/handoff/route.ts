import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkParcel, type Check } from "@/lib/zg";
import { logHandoff } from "@/lib/hedera";
import { consignmentByParcel, handoffsFor, writeHandoff } from "@/lib/arkiv";

const short = (uid: string) => createHash("sha256").update(uid).digest("hex").slice(0, 12);

/**
 * One handoff from the phone: parcel tag, giver's badge, receiver's badge and a lid photo.
 * 0G decides; Hedera and Arkiv record. If 0G cannot decide, the handoff is kept as unchecked and pay is held.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const parcel = String(form.get("parcel") ?? "");
  const from = String(form.get("from") ?? "");
  const to = String(form.get("to") ?? "");
  const at = Number(form.get("at") ?? Date.now());
  const photoFile = form.get("photo");
  if (!parcel || !from || !to || !(photoFile instanceof File)) {
    return NextResponse.json({ verdict: "unchecked", message: "Missing parcel, badges or photo." }, { status: 400 });
  }
  const photo = Buffer.from(await photoFile.arrayBuffer());
  const photoSha256 = createHash("sha256").update(photo).digest("hex");

  const c = await consignmentByParcel(parcel);
  if (!c) {
    return NextResponse.json({ verdict: "held", message: "Yeh parcel register nahi hai. This parcel is not registered." }, { status: 404 });
  }
  const past = await handoffsFor(c.code);
  const done = new Set(past.filter((h) => h.verdict !== "held").map((h) => h.hop));
  const leg = c.route.find((l) => !done.has(l.hop));
  if (!leg) return NextResponse.json({ verdict: "held", message: "Is parcel ki delivery poori ho chuki hai. Already delivered.", code: c.code });

  const errors: string[] = [];
  const rightPeople = leg.from === from && leg.to === to;
  let verdict: "green" | "held" | "unchecked" = "unchecked";
  let reason = "Tapped, not checked by AI. Payment waits for a review.";
  let check: Check | null = null;

  try {
    check = await checkParcel(photo, c.code, `hop ${leg.hop} at ${leg.place}`);
    verdict = check.match && check.condition === "intact" && rightPeople ? "green" : "held";
    reason = !rightPeople
      ? "These badges are not the drivers booked for this hop."
      : check.match
        ? check.condition === "intact" ? "Code matches and the parcel looks intact." : `Parcel looks ${check.condition}: ${check.reason}`
        : `Code on the parcel reads "${check.codeRead}", expected ${c.code}.`;
  } catch (e) {
    errors.push(`0G: ${(e as Error).message.slice(0, 160)}`);
  }

  let hcs: { topicId: string; sequence: string } | undefined;
  try {
    hcs = await logHandoff({
      t: "daak.handoff", code: c.code, hop: leg.hop, from: short(from), to: short(to),
      verdict, zg: check?.requestId ?? null, photo: photoSha256, at,
    });
  } catch (e) {
    errors.push(`Hedera: ${(e as Error).message.slice(0, 160)}`);
  }

  let arkiv: { entityKey: string; txHash: string } | undefined;
  try {
    arkiv = await writeHandoff({
      code: c.code, hop: leg.hop, verdict, place: leg.place, fromBadge: short(from), toBadge: short(to), at,
      zgRequestId: check?.requestId ?? "", hcs: hcs ? `${hcs.topicId}#${hcs.sequence}` : "", photoSha256, reason,
    });
  } catch (e) {
    errors.push(`Arkiv: ${(e as Error).message.slice(0, 160)}`);
  }

  const message =
    verdict === "green" ? `Saunp diya. ${leg.place} tak. Payment jaari.`
    : verdict === "held" ? `Payment roka gaya. ${reason}`
    : "AI jaanch nahi ho payi. Handoff save hai, payment jaanch tak ruka hai.";
  return NextResponse.json({
    verdict, message, code: c.code, hop: leg.hop, reason,
    proofs: { zg: check && { requestId: check.requestId, verified: check.verified, model: check.model }, hcs, arkiv },
    errors,
  });
}
