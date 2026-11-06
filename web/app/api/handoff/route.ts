import { denied, isApp, isOperator } from "@/lib/auth";
import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { checkParcel, type Check } from "@/lib/zg";
import { backupCheck, backupReady, backupVerdict, type Backup } from "@/lib/backup";
import { submitLog } from "@/lib/hedera";
import { consignmentByParcel, handoffsFor, writeHandoff } from "@/lib/arkiv";
import { releaseFee, hashscan } from "@/lib/payout";
import { cashOutAll } from "@/lib/settle";
import { isSplit, payAdvance, settleDelivered } from "@/lib/split";
import { sealRef, uploadPhoto } from "@/lib/swarm";
import { logDecision } from "@/lib/zgstore";
import { getBadge } from "@/lib/arkiv";
import { checkReceiveProof, handoffMessage, verifyHandoff } from "@/lib/signing";
import { heldReasonHi, placeCheck } from "@/lib/rules";
import { readLog } from "@/lib/history";


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

  // If the giver or the taker has a registered phone, the handoff must be signed by one of those phones. Only a
  // handoff between two people who have never registered a phone (scripts, the very first sign-in) goes unsigned.
  const signer = String(form.get("signer") ?? "");
  const sig = String(form.get("sig") ?? "");
  let signed: "valid" | "unsigned" = "unsigned";
  const [giver, taker] = await Promise.all([getBadge(from).catch(() => null), getBadge(to).catch(() => null)]);
  if (giver?.devicePub || taker?.devicePub) {
    const who = signer === from ? giver : signer === to ? taker : null;
    if (!who?.devicePub || !sig || !verifyHandoff(who.devicePub, handoffMessage({ parcel, from, to, at, photoSha256 }), sig)) {
      return NextResponse.json({ verdict: "held", message: "Signature check failed. This handoff did not come from the giver's or the taker's registered phone.", reasonHi: heldReasonHi(String("Signature check failed. This handoff did not come from the giver's or the taker's registered phone.")) }, { status: 401 });
    }
    signed = "valid";
  }
  // How the other person confirmed: their own phone's fresh code, scanned by the one recording (so both phones
  // signed), or a badge tap. The code must come from whichever of giver and taker did not record the handoff.
  const otherCode = String(form.get("otherCode") ?? form.get("takerCode") ?? "");
  let confirm: { by: "code"; who: string; nonce: string; issuedAt: number; sig: string } | { by: "badge" } = { by: "badge" };
  if (otherCode) {
    const other = signer === from ? { uid: to, badge: taker } : { uid: from, badge: giver };
    const used = new Set((await readLog().catch(() => [])).map((m) => (m as { confirm?: { nonce?: string } }).confirm?.nonce).filter((n): n is string => Boolean(n)));
    // Fresh relative to the handoff's own signed time, so a handoff queued offline still counts when it arrives.
    const proof = checkReceiveProof(otherCode, { to: other.uid, devicePub: other.badge?.devicePub, now: at, used });
    if (!proof.ok) return NextResponse.json({ verdict: "held", message: proof.why, reasonHi: heldReasonHi(String(proof.why)) }, { status: 401 });
    // Their signature goes on the public log too, so anyone can check both people signed.
    const parts = otherCode.split("|");
    confirm = { by: "code", who: short(other.uid), nonce: proof.nonce, issuedAt: Number(parts.at(-3)), sig: parts.at(-1)! };
  }
  if (Math.abs(at - Date.now()) > 48 * 3600_000) return NextResponse.json({ verdict: "held", message: "The handoff time is not plausible.", reasonHi: heldReasonHi(String("The handoff time is not plausible.")) }, { status: 400 });

  // A booking written seconds ago can take a few seconds to show in Arkiv queries.
  let c = await consignmentByParcel(parcel);
  for (let i = 0; !c && i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    c = await consignmentByParcel(parcel);
  }
  if (!c) {
    return NextResponse.json({ verdict: "held", message: "Yeh parcel register nahi hai. This parcel is not registered.", reasonHi: heldReasonHi(String("Yeh parcel register nahi hai. This parcel is not registered.")) }, { status: 404 });
  }
  const consignment = c;
  const past = await handoffsFor(consignment.code);
  // The same photo again: an outbox retry after a timeout, or a photo reused for another stop. Answer with the
  // first record and never record (or pay) twice. The public log is checked too, as Arkiv shows new rows late.
  const seenArkiv = past.find((h) => h.photoSha256 === photoSha256);
  const seenLog = seenArkiv ? null : (await readLog().catch(() => [])).find((m) => m.t === "daak.handoff" && m.code === consignment.code && (m as { photo?: string }).photo === photoSha256);
  if (seenArkiv || seenLog) {
    const v = seenArkiv?.verdict ?? seenLog?.verdict ?? "unchecked";
    return NextResponse.json({ verdict: v, message: "Yeh photo pehle hi darj hai. This photo was already recorded for this parcel; take a new photo for a new stop.", code: consignment.code, hop: seenArkiv?.hop ?? seenLog?.hop, duplicate: true });
  }
  // A stop counts by its latest attempt: a mistaken tap that was held and then redone does not block the parcel.
  const latestByHop = new Map([...past].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));
  const done = new Set([...latestByHop].filter(([, v]) => v !== "held").map(([hop]) => hop));
  const leg = consignment.route.find((l) => !done.has(l.hop));
  if (!leg) return NextResponse.json({ verdict: "held", message: "Is parcel ki delivery poori ho chuki hai. Already delivered.", code: consignment.code });

  const errors: string[] = [];
  const rightPeople = leg.from === from && leg.to === to;
  // The stand check: within STAND_RADIUS_M (500 m by default) of the stop's stand, GPS accuracy capped at 200 m.
  const place = placeCheck(spot, leg.lat != null && leg.lng != null ? { lat: leg.lat, lng: leg.lng } : null, Number(process.env.STAND_RADIUS_M ?? 500));
  const rightPlace = place.ok;
  const away = place.metres ?? 0;
  const placeReason = place.metres == null ? `No GPS fix, so the handoff could not be placed at ${leg.place}.` : `Handoff happened ${Math.round(away)} m from ${leg.place}.`;
  let verdict: "green" | "held" | "unchecked" = "unchecked";
  let reason = "Tapped, not checked by AI. Payment waits for a review.";
  let check: Check | null = null;
  let backup: Backup | null = null;

  try {
    check = await checkParcel(photo, consignment.code, `hop ${leg.hop} at ${leg.place}`);
    verdict = check.match && check.condition === "intact" && rightPeople && rightPlace ? "green" : "held";
    reason = !rightPeople
      ? "These badges are not the drivers booked for this hop."
      : !rightPlace
        ? placeReason
        : check.match
          ? check.condition === "intact" ? "Code matches and the parcel looks intact." : `Parcel looks ${check.condition}: ${check.reason}`
          : `Code on the parcel reads "${check.codeRead}", expected ${consignment.code}.`;
  } catch (e) {
    errors.push(`0G: ${(e as Error).message.slice(0, 160)}`);
    // Safe-stop. Wrong badges or the wrong place hold the payment whatever any model says.
    if (!rightPeople || !rightPlace) {
      verdict = "held";
      reason = !rightPeople ? "These badges are not the drivers booked for this hop." : placeReason;
    } else if (backupReady()) {
      // The labelled backup model looks at the photo: a problem holds the payment now; a pass still waits for 0G.
      try {
        backup = await backupCheck(photo, consignment.code, `hop ${leg.hop} at ${leg.place}`);
        verdict = backupVerdict(backup, rightPeople, rightPlace);
        const seen = backup.match ? (backup.condition === "intact" ? "code matches and the parcel looks intact" : `parcel looks ${backup.condition}`) : `code reads "${backup.codeRead}", expected ${consignment.code}`;
        reason = `Backup check (${backup.provider}, not sealed): ${seen}. ` +
          (verdict === "held" ? "Payment held." : verdict === "green" ? "Test mode: paid on the backup check." : "Payment waits for 0G's sealed check.");
      } catch (b) {
        errors.push(`backup: ${(b as Error).message.slice(0, 160)}`);
      }
    }
  }

  const geo = spot ? `${spot.lat.toFixed(5)},${spot.lng.toFixed(5)},${Math.round(spot.acc)}` : undefined;
  let log: Awaited<ReturnType<typeof submitLog>> | null = null;
  try {
    log = await submitLog({
      t: "daak.handoff", code: consignment.code, hop: leg.hop, km: leg.km ?? null, from: short(from), to: short(to),
      verdict, zg: check?.requestId ?? null, photo: photoSha256, at,
      geo: spot ? [Number(spot.lat.toFixed(4)), Number(spot.lng.toFixed(4))] : null,
      signer: signer ? short(signer) : null, sig: signed === "valid" ? sig : null, confirm,
      backup: backup && { provider: backup.provider, model: backup.model, match: backup.match, condition: backup.condition },
    });
  } catch (e) {
    errors.push(`Hedera: ${(e as Error).message.slice(0, 160)}`);
  }

  const lastLeg = leg.hop === Math.max(...consignment.route.map((l) => l.hop));
  const allGreen = lastLeg && verdict === "green" && consignment.route.filter((l) => l.hop !== leg.hop).every((l) => latestByHop.get(l.hop) === "green");
  const split = isSplit(consignment);
  const willPay = allGreen && (split || Boolean(consignment.schedule));
  // Split payout: a confirmed handover pays that driver's advance at once; delivery starts the holdback timer.
  const paysAdvance = split && verdict === "green" && (leg.km ?? 0) > 0;

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
    if (paysAdvance && !willPay) {
      try { await payAdvance(consignment, leg.hop); } catch (e) { console.error("advance", e); }
    }
    if (willPay) {
      try {
        if (split) await settleDelivered(consignment);
        else { await releaseFee(consignment.schedule!); await cashOutAll(consignment); }
      } catch (e) { console.error("payout", e); }
    }
  });

  const message =
    willPay ? "Delivery poori. Sab drivers ko payment ho raha hai."
    : paysAdvance ? `Saunp diya. ${leg.place} tak. ${leg.advancePct ?? 50}% payment abhi, baaki delivery par.`
    : verdict === "green" ? `Saunp diya. ${leg.place} tak. Payment jaari.`
    : verdict === "held" ? `Payment roka gaya. ${reason}`
    : backup ? `Backup jaanch theek. Payment 0G jaanch tak ruka hai.`
    : "AI jaanch nahi ho payi. Handoff save hai, payment jaanch tak ruka hai.";
  return NextResponse.json({
    verdict, message, code: consignment.code, hop: leg.hop, reason, reasonHi: verdict === "held" ? heldReasonHi(reason) : null, signed,
    proofs: {
      zg: check && { requestId: check.requestId, verified: check.verified, model: check.model },
      backup: backup && { provider: backup.provider, model: backup.model, sealed: false },
      hcs: log && { topicId: log.topicId, tx: hashscan("transaction", log.txId) },
      payout: willPay ? "releasing" : paysAdvance ? "advance" : undefined,
    },
    errors,
  });
}
