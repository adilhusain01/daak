import { denied, isApp, isOperator } from "@/lib/auth";
import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { checkParcel, type Check } from "@/lib/zg";
import { submitLog } from "@/lib/hedera";
import { consignmentByParcel, handoffsFor, writeHandoff } from "@/lib/arkiv";
import { releaseFee, hashscan } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { sealRef, uploadPhoto } from "@/lib/swarm";
import { logDecision } from "@/lib/zgstore";
import { getBadge } from "@/lib/arkiv";
import { handoffMessage, verifyHandoff } from "@/lib/signing";

/** Metres between two points on the earth. */
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const short = (uid: string) => createHash("sha256").update(uid).digest("hex").slice(0, 12);

/**
 * One handoff from the phone: parcel tag, giver's badge, receiver's badge, a lid photo and GPS.
 * The driver gets the verdict as soon as 0G decides and Hedera accepts the log message; the Arkiv
 * record, the encrypted photo on Swarm and any payout finish after the response.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
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

  // The handoff must be signed by the phone of whoever recorded it (giver or taker), if they registered one.
  const signer = String(form.get("signer") ?? "");
  const sig = String(form.get("sig") ?? "");
  let signed: "valid" | "unsigned" = "unsigned";
  if (signer && (signer === from || signer === to)) {
    const who = await getBadge(signer).catch(() => null);
    if (who?.devicePub) {
      if (!sig || !verifyHandoff(who.devicePub, handoffMessage({ parcel, from, to, at, photoSha256 }), sig)) {
        return NextResponse.json({ verdict: "held", message: "Signature check failed. This handoff did not come from the registered phone." }, { status: 401 });
      }
      signed = "valid";
    }
  }

  // A booking written seconds ago can take a few seconds to show in Arkiv queries.
  let c = await consignmentByParcel(parcel);
  for (let i = 0; !c && i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    c = await consignmentByParcel(parcel);
  }
  if (!c) {
    return NextResponse.json({ verdict: "held", message: "Yeh parcel register nahi hai. This parcel is not registered." }, { status: 404 });
  }
  const consignment = c;
  const past = await handoffsFor(consignment.code);
  const done = new Set(past.filter((h) => h.verdict !== "held").map((h) => h.hop));
  const leg = consignment.route.find((l) => !done.has(l.hop));
  if (!leg) return NextResponse.json({ verdict: "held", message: "Is parcel ki delivery poori ho chuki hai. Already delivered.", code: consignment.code });

  const errors: string[] = [];
  const rightPeople = leg.from === from && leg.to === to;
  // If the booking named the stand's coordinates, a handoff far from it is held.
  const away = spot && leg.lat != null && leg.lng != null ? metres(spot, { lat: leg.lat, lng: leg.lng }) - spot.acc : 0;
  const rightPlace = away <= 500;
  let verdict: "green" | "held" | "unchecked" = "unchecked";
  let reason = "Tapped, not checked by AI. Payment waits for a review.";
  let check: Check | null = null;

  try {
    check = await checkParcel(photo, consignment.code, `hop ${leg.hop} at ${leg.place}`);
    verdict = check.match && check.condition === "intact" && rightPeople && rightPlace ? "green" : "held";
    reason = !rightPeople
      ? "These badges are not the drivers booked for this hop."
      : !rightPlace
        ? `Handoff happened ${Math.round(away)} m from ${leg.place}.`
        : check.match
          ? check.condition === "intact" ? "Code matches and the parcel looks intact." : `Parcel looks ${check.condition}: ${check.reason}`
          : `Code on the parcel reads "${check.codeRead}", expected ${consignment.code}.`;
  } catch (e) {
    errors.push(`0G: ${(e as Error).message.slice(0, 160)}`);
  }

  const geo = spot ? `${spot.lat.toFixed(5)},${spot.lng.toFixed(5)},${Math.round(spot.acc)}` : undefined;
  let log: Awaited<ReturnType<typeof submitLog>> | null = null;
  try {
    log = await submitLog({
      t: "daak.handoff", code: consignment.code, hop: leg.hop, km: leg.km ?? null, from: short(from), to: short(to),
      verdict, zg: check?.requestId ?? null, photo: photoSha256, at,
      geo: spot ? [Number(spot.lat.toFixed(4)), Number(spot.lng.toFixed(4))] : null,
      signer: signer ? short(signer) : null, sig: signed === "valid" ? sig : null,
    });
  } catch (e) {
    errors.push(`Hedera: ${(e as Error).message.slice(0, 160)}`);
  }

  const lastLeg = leg.hop === Math.max(...consignment.route.map((l) => l.hop));
  const willPay = lastLeg && verdict === "green" && past.every((h) => h.verdict === "green") && Boolean(consignment.schedule);

  // Everything below runs after the driver already has the answer.
  after(async () => {
    const sequence = log ? await log.sequence().catch(() => "") : "";
    // 0G episode log: the decision at this checkpoint, whatever it was, with its request id.
    let zgLog = "";
    try {
      const rec = await logDecision({
        t: "daak.decision", code: consignment.code, hop: leg.hop, place: leg.place, verdict, reason,
        model: check?.model ?? null, requestId: check?.requestId ?? null, teeVerified: check?.verified ?? null,
        codeRead: check?.codeRead ?? null, condition: check?.condition ?? null, photoSha256, at, hcs: log?.txId ?? null,
      });
      zgLog = rec.rootHash;
    } catch (e) { console.error("0g storage", e); }
    let photoRef = "";
    try { photoRef = sealRef(await uploadPhoto(photo)); } catch (e) { console.error("swarm", e); }
    try {
      await writeHandoff({
        code: consignment.code, hop: leg.hop, verdict, place: leg.place, fromBadge: short(from), toBadge: short(to), at,
        zgRequestId: check?.requestId ?? "", hcs: log && sequence ? `${log.topicId}#${sequence}` : "", photoSha256, reason, geo, photo: photoRef, zgLog,
      });
    } catch (e) { console.error("arkiv", e); }
    if (willPay) {
      try { await releaseFee(consignment.schedule!); await cashOutAll(consignment); } catch (e) { console.error("payout", e); }
    }
  });

  const message =
    willPay ? "Delivery poori. Sab drivers ko payment ho raha hai."
    : verdict === "green" ? `Saunp diya. ${leg.place} tak. Payment jaari.`
    : verdict === "held" ? `Payment roka gaya. ${reason}`
    : "AI jaanch nahi ho payi. Handoff save hai, payment jaanch tak ruka hai.";
  return NextResponse.json({
    verdict, message, code: consignment.code, hop: leg.hop, reason, signed,
    proofs: {
      zg: check && { requestId: check.requestId, verified: check.verified, model: check.model },
      hcs: log && { topicId: log.topicId, tx: hashscan("transaction", log.txId) },
      payout: willPay ? "releasing" : undefined,
    },
    errors,
  });
}
