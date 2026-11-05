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
