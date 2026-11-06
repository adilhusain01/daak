import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { denied, isApp } from "@/lib/auth";
import { getBadge } from "@/lib/arkiv";
import { readLog } from "@/lib/history";
import { submitLog } from "@/lib/hedera";
import { checkReceiveProof, verifyHandoff, vouchMessage } from "@/lib/signing";
import { vouchStanding } from "@/lib/rules";

const short = (uid: string) => createHash("sha256").update(uid).digest("hex").slice(0, 12);

/**
 * A vouch: someone whose ID Daak has checked scans a newcomer's code and signs "I know this person". Both
 * signatures go on the public log; the newcomer's record shows who vouched. One vouch per pair, three per voucher in
 * 30 days, and none for 90 days after someone the voucher vouched for is found responsible for a damaged parcel.
 */
export async function POST(req: Request) {
  if (!isApp(req)) return denied("app");
  const { voucher, code, sig } = (await req.json()) as { voucher?: string; code?: string; sig?: string };
  if (!voucher || !code || !sig) return NextResponse.json({ error: "Missing voucher, code or signature" }, { status: 400 });
  const uid = code.split("|").slice(1, -3).join("|");
  if (uid === voucher) return NextResponse.json({ error: "You cannot vouch for yourself." }, { status: 400 });
  const [by, newcomer] = await Promise.all([getBadge(voucher).catch(() => null), getBadge(uid).catch(() => null)]);
  if (!by?.devicePub || !verifyHandoff(by.devicePub, vouchMessage(voucher, code), sig)) return NextResponse.json({ error: "This vouch was not signed by your registered phone." }, { status: 401 });
  if (by.kycStatus !== "verified") return NextResponse.json({ error: "Only someone whose ID Daak has checked can vouch. Add your ID on the Me tab." }, { status: 403 });
  if (!newcomer) return NextResponse.json({ error: "That person has not joined Daak yet." }, { status: 404 });
  const log = await readLog().catch(() => []);
  // A vouch puts the voucher's own standing on the line: three in 30 days at most, none after a bad one.
  const standing = vouchStanding(log as never, short(voucher), Date.now());
  if (!standing.ok) return NextResponse.json({ error: standing.why }, { status: 429 });
  const used = new Set(log.map((m) => (m as { nonce?: string; confirm?: { nonce?: string } }).nonce ?? (m as { confirm?: { nonce?: string } }).confirm?.nonce).filter((n): n is string => Boolean(n)));
  const proof = checkReceiveProof(code, { to: uid, devicePub: newcomer.devicePub, now: Date.now(), used });
  if (!proof.ok) return NextResponse.json({ error: proof.why }, { status: 401 });
  if (log.some((m) => m.t === "daak.vouched" && (m as { who?: string }).who === short(uid) && (m as { by?: string }).by === short(voucher))) {
    return NextResponse.json({ error: `You have already vouched for ${newcomer.name.split(",")[0]}.` }, { status: 409 });
  }
  const parts = code.split("|");
  const entry = await submitLog({
    t: "daak.vouched", who: short(uid), by: short(voucher), byName: by.name.split(",")[0],
    nonce: proof.nonce, issuedAt: Number(parts.at(-3)), whoSig: parts.at(-1), bySig: sig,
  });
  return NextResponse.json({ ok: true, name: newcomer.name.split(",")[0], hcs: entry ? `${entry.topicId}#${entry.sequence}` : null });
}
