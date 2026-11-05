import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkParcel, type Check } from "@/lib/zg";
import { logHandoff } from "@/lib/hedera";
import { releaseFee, hashscan } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { consignmentByParcel, handoffsFor, writeHandoff } from "@/lib/arkiv";

/** Metres between two points on the earth. */
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
  const lat = Number(form.get("lat")), lng = Number(form.get("lng")), acc = Number(form.get("acc") ?? 0);
  const spot = Number.isFinite(lat) && Number.isFinite(lng) && form.get("lat") !== null ? { lat, lng, acc } : null;
  if (!parcel || !from || !to || !(photoFile instanceof File)) {
    return NextResponse.json({ verdict: "unchecked", message: "Missing parcel, badges or photo." }, { status: 400 });
  }
  const photo = Buffer.from(await photoFile.arrayBuffer());
  const photoSha256 = createHash("sha256").update(photo).digest("hex");

  // A booking written seconds ago can take a few seconds to show in Arkiv queries.
  let c = await consignmentByParcel(parcel);
  for (let i = 0; !c && i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    c = await consignmentByParcel(parcel);
  }
  if (!c) {
    return NextResponse.json({ verdict: "held", message: "Yeh parcel register nahi hai. This parcel is not registered." }, { status: 404 });
  }
  const past = await handoffsFor(c.code);
  const done = new Set(past.filter((h) => h.verdict !== "held").map((h) => h.hop));
  const leg = c.route.find((l) => !done.has(l.hop));
  if (!leg) return NextResponse.json({ verdict: "held", message: "Is parcel ki delivery poori ho chuki hai. Already delivered.", code: c.code });

  const errors: string[] = [];
  const rightPeople = leg.from === from && leg.to === to;
  // If the booking named the stand's coordinates, a handoff far from it is held.
  const away = spot && leg.lat != null && leg.lng != null ? metres(spot, { lat: leg.lat, lng: leg.lng }) - spot.acc : 0;
  const rightPlace = away <= 500;
  let verdict: "green" | "held" | "unchecked" = "unchecked";
  let reason = "Tapped, not checked by AI. Payment waits for a review.";
  let check: Check | null = null;

  try {
    check = await checkParcel(photo, c.code, `hop ${leg.hop} at ${leg.place}`);
    verdict = check.match && check.condition === "intact" && rightPeople && rightPlace ? "green" : "held";
    reason = !rightPeople
      ? "These badges are not the drivers booked for this hop."
      : !rightPlace
        ? `Handoff happened ${Math.round(away)} m from ${leg.place}.`
      : check.match
        ? check.condition === "intact" ? "Code matches and the parcel looks intact." : `Parcel looks ${check.condition}: ${check.reason}`
        : `Code on the parcel reads "${check.codeRead}", expected ${c.code}.`;
  } catch (e) {
    errors.push(`0G: ${(e as Error).message.slice(0, 160)}`);
  }

  let hcs: { topicId: string; sequence: string } | undefined;
  try {
    hcs = await logHandoff({
      t: "daak.handoff", code: c.code, hop: leg.hop, km: leg.km ?? null, from: short(from), to: short(to),
      verdict, zg: check?.requestId ?? null, photo: photoSha256, at, geo: spot ? [Number(spot.lat.toFixed(4)), Number(spot.lng.toFixed(4))] : null,
    });
  } catch (e) {
    errors.push(`Hedera: ${(e as Error).message.slice(0, 160)}`);
  }

  let arkiv: { entityKey: string; txHash: string } | undefined;
  try {
    arkiv = await writeHandoff({
      code: c.code, hop: leg.hop, verdict, place: leg.place, fromBadge: short(from), toBadge: short(to), at,
      zgRequestId: check?.requestId ?? "", hcs: hcs ? `${hcs.topicId}#${hcs.sequence}` : "", photoSha256, reason,
      geo: spot ? `${spot.lat.toFixed(5)},${spot.lng.toFixed(5)},${Math.round(spot.acc)}` : undefined,
    });
  } catch (e) {
    errors.push(`Arkiv: ${(e as Error).message.slice(0, 160)}`);
  }

  // The last hop passing the check is the delivery: escrow signs and the scheduled payout runs.
  let payout: { releaseTx: string; url: string } | undefined;
  const lastLeg = leg.hop === Math.max(...c.route.map((l) => l.hop));
  const clean = past.every((h) => h.verdict === "green");
  if (lastLeg && verdict === "green" && clean && c.schedule) {
    try {
      const r = await releaseFee(c.schedule);
      payout = { ...r, url: hashscan("transaction", r.releaseTx) };
      await cashOutAll(c).catch((e) => errors.push(`UPI: ${(e as Error).message.slice(0, 160)}`));
    } catch (e) {
      errors.push(`Payout: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  const message =
    payout ? `Delivery poori. Sab drivers ko payment ho gaya.`
    : verdict === "green" ? `Saunp diya. ${leg.place} tak. Payment jaari.`
    : verdict === "held" ? `Payment roka gaya. ${reason}`
    : "AI jaanch nahi ho payi. Handoff save hai, payment jaanch tak ruka hai.";
  return NextResponse.json({
    verdict, message, code: c.code, hop: leg.hop, reason,
    proofs: { zg: check && { requestId: check.requestId, verified: check.verified, model: check.model }, hcs, arkiv, payout },
    errors,
  });
}
