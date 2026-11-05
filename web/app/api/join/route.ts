import { NextResponse } from "next/server";
import { putBadge } from "@/lib/arkiv";
import { network } from "@/lib/network";
import { seal } from "@/lib/swarm";
import { submitLog } from "@/lib/hedera";
import { badgeHash } from "@/lib/history";

type Join = { uid: string; role: "driver" | "sender" | "receiver"; name: string; phone: string; upi?: string; vehicle?: string; legs?: string[]; stop?: string };

/**
 * A new person joins by tapping their badge. Name, role, stretches and bus stand are public; phone and UPI ID
 * are sealed before they go into the public record. The join is announced on the public log by badge hash only.
 */
export async function POST(req: Request) {
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
  if (j.role !== "driver" && !net.stops.some((s) => s.id === j.stop)) errors.push("Choose your bus stand");
  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const phone = j.phone.replace(/\D/g, "").slice(-10);
  const sealed = seal(JSON.stringify({ phone, upi: j.upi ?? "" }), "person");
  const arkiv = await putBadge({
    uid: j.uid, role: j.role, name: j.name.trim(), vehicle: (j.vehicle ?? "").toUpperCase(),
    legs: j.role === "driver" ? j.legs : [], stop: j.role === "driver" ? undefined : j.stop, private: sealed,
  });
  const log = await submitLog({ t: "daak.joined", role: j.role, id: badgeHash(j.uid), legs: j.legs ?? null, stop: j.stop ?? null }).catch(() => null);
  return NextResponse.json({ ok: true, arkiv, hcs: log?.txId ?? null });
}
