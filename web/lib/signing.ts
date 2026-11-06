import { createPublicKey, verify } from "node:crypto";

/**
 * Each handoff is signed on the phone of the person who recorded it, with a P-256 key that never leaves the
 * phone's secure hardware. The public key sits on that person's Arkiv record and the signature goes on the
 * public Hedera log, so anyone can check that Daak did not invent a handoff.
 */
export const handoffMessage = (h: { parcel: string; from: string; to: string; at: number; photoSha256: string }) =>
  `daak.handoff|${h.parcel}|${h.from}|${h.to}|${h.at}|${h.photoSha256}`;

export function verifyHandoff(devicePubB64: string, message: string, sigB64: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(devicePubB64, "base64"), format: "der", type: "spki" });
    return verify("sha256", Buffer.from(message), key, Buffer.from(sigB64, "base64"));
  } catch {
    return false;
  }
}

/** What a phone signs for its owner's code (shown to the other person at a handoff): who, when, and a one-time value. */
export const receiveMessage = (t: { uid: string; issuedAt: number; nonce: string }) => `daak.receive|${t.uid}|${t.issuedAt}|${t.nonce}`;

/** A taker's code lasts two minutes; the phone shows a new one every 30 seconds. */
export const RECEIVE_MAX_AGE_MS = 2 * 60_000;

/**
 * The taker's code, "DAAK1|uid|issuedAt|nonce|sig", scanned by the giver: it proves the taker's own phone was there
 * just now. Refused if it names someone else, is not signed by the taker's registered phone, is stale, or was used.
 */
export function checkReceiveProof(code: string, o: { to: string; devicePub?: string; now: number; used: Set<string> }): { ok: true; nonce: string } | { ok: false; why: string } {
  const parts = code.split("|");
  if (parts.length < 5 || parts[0] !== "DAAK1") return { ok: false, why: "That is not a Daak code." };
  const sig = parts.at(-1)!, nonce = parts.at(-2)!, issuedAt = Number(parts.at(-3));
  const uid = parts.slice(1, -3).join("|");
  if (uid !== o.to) return { ok: false, why: "This code belongs to someone else, not the person on this handoff." };
  if (!o.devicePub) return { ok: false, why: "That person has no registered phone; tap their badge instead." };
  if (!Number.isFinite(issuedAt) || o.now - issuedAt > RECEIVE_MAX_AGE_MS || issuedAt - o.now > 30_000) return { ok: false, why: "This code has expired; ask for the new one on their screen." };
  if (o.used.has(nonce)) return { ok: false, why: "This code was already used." };
  if (!verifyHandoff(o.devicePub, receiveMessage({ uid, issuedAt, nonce }), sig)) return { ok: false, why: "This code was not signed by that person's phone." };
  return { ok: true, nonce };
}
