import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { load, save, type HandoffRecord } from "@/lib/store";
import { checkParcel } from "@/lib/zg";
import { logHandoff } from "@/lib/hedera";
import { writeHandoff } from "@/lib/arkiv";


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

  const db = load();
  const c = db.consignments.find((x) => x.parcel === parcel);
  if (!c) {
    return NextResponse.json({ verdict: "held", message: "Yeh parcel register nahi hai. This parcel is not registered." }, { status: 404 });
  }
  const done = db.handoffs.filter((h) => h.code === c.code && h.verdict !== "held").length;
  const leg = c.route[done];
  if (!leg) return NextResponse.json({ verdict: "held", message: "Is parcel ki delivery poori ho chuki hai. Already delivered.", code: c.code });

  const errors: string[] = [];
  const record: HandoffRecord = { code: c.code, hop: leg.hop, from, to, at, verdict: "unchecked", reason: "", photoSha256, errors };

  // Wrong people at this hop is a hold, whatever the photo shows.
  const rightPeople = leg.from === from && leg.to === to;

  try {
    const check = await checkParcel(photo, c.code, `hop ${leg.hop} at ${leg.place}`);
    record.zg = { requestId: check.requestId, verified: check.verified, model: check.model };
    record.verdict = check.match && check.condition === "intact" && rightPeople ? "green" : "held";
    record.reason = !rightPeople
      ? "These badges are not the drivers booked for this hop."
      : check.match
        ? check.condition === "intact" ? "Code matches and the parcel looks intact." : `Parcel looks ${check.condition}: ${check.reason}`
        : `Code on the parcel reads "${check.codeRead}", expected ${c.code}.`;
  } catch (e) {
    record.verdict = "unchecked";
    record.reason = "Tapped, not checked by AI. Payment waits for a review.";
    errors.push(`0G: ${(e as Error).message.slice(0, 160)}`);
  }

  try {
    record.hcs = await logHandoff({
      t: "daak.handoff", code: c.code, hop: leg.hop, from: short(from), to: short(to),
      verdict: record.verdict, zg: record.zg?.requestId ?? null, photo: photoSha256, at,
    });
  } catch (e) {
    errors.push(`Hedera: ${(e as Error).message.slice(0, 160)}`);
  }

  try {
    record.arkiv = await writeHandoff({
      code: c.code, hop: leg.hop, verdict: record.verdict, place: leg.place, fromBadge: short(from), toBadge: short(to),
      at, zgRequestId: record.zg?.requestId ?? "", hcs: record.hcs ? `${record.hcs.topicId}#${record.hcs.sequence}` : "", photoSha256,
    });
  } catch (e) {
    errors.push(`Arkiv: ${(e as Error).message.slice(0, 160)}`);
  }

  db.handoffs.push(record);
  save(db);

  const message =
    record.verdict === "green" ? `Saunp diya. ${leg.place} tak. Payment jaari.`
    : record.verdict === "held" ? `Payment roka gaya. ${record.reason}`
    : "AI jaanch nahi ho payi. Handoff save hai, payment jaanch tak ruka hai.";
  return NextResponse.json({ verdict: record.verdict, message, code: c.code, hop: leg.hop, reason: record.reason, proofs: { zg: record.zg, hcs: record.hcs, arkiv: record.arkiv }, errors });
}
