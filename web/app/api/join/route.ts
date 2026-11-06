import { denied, isApp, isOperator } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getBadge, putBadge } from "@/lib/arkiv";
import { encodeTimetables } from "@/lib/timetable";
import { network } from "@/lib/network";
import { seal, sealRef, uploadPhoto } from "@/lib/swarm";
import { submitLog } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";

type Join = {
  uid: string; role: "driver" | "sender" | "receiver"; name: string; phone: string; upi?: string; vehicle?: string; legs?: string[]; stop?: string;
  /** Drivers: who runs the bus, and a government ID for KYC. */
  busOperator?: string; idType?: string; idLast4?: string; idPhoto?: string;
  /** Drivers: when their bus leaves on each stretch, "HH:MM" (days default Monday to Saturday). */
  times?: Record<string, string>;
};

const BUS_OPERATORS = ["UPSRTC", "BSRTC", "Private"];
/** Driving licence first: a bus driver must hold one, so it proves identity and the right to drive. Aadhaar only masked. */
const ID_TYPES: Record<string, string> = { dl: "Driving licence", voter: "Voter ID", aadhaar_masked: "Masked Aadhaar" };
/** Indian registration plates: UP78AT1123, UP 78 AT 1123, UP-78-AT-1123, or BH series 22BH1234AA. */
const PLATE = /^([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{0,3}[ -]?\d{4}|\d{2}[ -]?BH[ -]?\d{4}[ -]?[A-Z]{1,2})$/;

/**
 * A new person joins by tapping their badge. Name, role, stretches and bus stand are public; phone and UPI ID
 * are sealed before they go into the public record. The join is announced on the public log by badge hash only.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const j = (await req.json()) as Join;
  const net = network();
  const errors: string[] = [];
  if (!j.uid) errors.push("Tap a badge first");
  if (!["driver", "sender", "receiver"].includes(j.role)) errors.push("Choose driver, shop or receiver");
  if (!j.name || j.name.trim().length < 2) errors.push("Enter a name");
  if (!/^[6-9]\d{9}$/.test((j.phone ?? "").replace(/\D/g, "").slice(-10))) errors.push("Enter a 10-digit mobile number");
  if (j.role === "driver" && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(j.upi ?? "")) errors.push("Enter a UPI ID like name@okbank");
  if (j.role === "driver" && !(j.legs ?? []).every((l) => net.legs.some((x) => x.id === l))) errors.push("Unknown route stretch");
  if (j.role === "driver" && !(j.legs ?? []).length) errors.push("Choose at least one stretch you drive");
  const plate = (j.vehicle ?? "").toUpperCase().trim();
  if (j.role === "driver" && !PLATE.test(plate)) errors.push("Enter the bus number as on its number plate, like UP-78-AT-1123");
  if (j.role === "driver" && !BUS_OPERATORS.includes(j.busOperator ?? "")) errors.push("Choose who runs the bus");
  if (j.role === "driver" && !ID_TYPES[j.idType ?? ""]) errors.push("Choose a government ID");
  if (j.role === "driver" && !/^[A-Z0-9]{4}$/i.test(j.idLast4 ?? "")) errors.push("Enter the last 4 characters of the ID number");
  const idPhoto = j.role === "driver" && j.idPhoto ? Buffer.from(j.idPhoto, "base64") : null;
  if (j.role === "driver" && (!idPhoto || idPhoto.length < 10_000 || idPhoto.length > 3_000_000)) errors.push("Take a clear photo of the ID");
  if (j.role !== "driver" && !net.stops.some((s) => s.id === j.stop)) errors.push("Choose your bus stand");
  for (const [leg, t] of Object.entries(j.times ?? {})) {
    if (!(j.legs ?? []).includes(leg) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) errors.push("Enter each bus time as HH:MM, like 06:30");
  }
  if (errors.length) return NextResponse.json({ ok: false, errors: [...new Set(errors)] }, { status: 400 });
  // A badge that has joined cannot be rewritten from a phone (that would let anyone redirect a driver's UPI).
  // Changing a person's details goes through the operator.
  if (!isOperator(req) && (await getBadge(j.uid).catch(() => null))) return NextResponse.json({ ok: false, errors: ["This badge has already joined. Ask Daak to change its details."] }, { status: 409 });

  const phone = j.phone.replace(/\D/g, "").slice(-10);
  const sealed = seal(JSON.stringify({ phone, upi: j.upi ?? "" }), "person");
  // The ID photo is encrypted on Swarm; its reference, the ID type and last 4 are sealed again before Arkiv.
  // Only the last 4 characters are kept, never the full number (and Aadhaar only masked).
  let kyc: string | undefined;
  if (idPhoto) {
    const photo = sealRef(await uploadPhoto(idPhoto));
    kyc = seal(JSON.stringify({ idType: j.idType, last4: j.idLast4!.toUpperCase(), photo, at: Date.now() }), "kyc");
  }
  const vehicle = j.role === "driver" ? `${plate.replace(/[ -]/g, "")} · ${j.busOperator}` : (j.vehicle ?? "").toUpperCase();
  const arkiv = await putBadge({
    uid: j.uid, role: j.role, name: j.name.trim(), vehicle,
    legs: j.role === "driver" ? j.legs : [], stop: j.role === "driver" ? undefined : j.stop, private: sealed, kyc,
    timetable: j.role === "driver" ? encodeTimetables(Object.fromEntries(Object.entries(j.times ?? {}).map(([leg, dep]) => [leg, { dep, days: "1111110" }]))) || undefined : undefined,
  });
  const log = await submitLog({ t: "daak.joined", role: j.role, id: badgeHash(j.uid), legs: j.legs ?? null, stop: j.stop ?? null, kyc: kyc ? "pending" : null }).catch(() => null);
  return NextResponse.json({ ok: true, arkiv, hcs: log?.txId ?? null });
}
