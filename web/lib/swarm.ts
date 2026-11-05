import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Handoff photos go to Swarm encrypted (Swarm-Encrypt: the reference carries the decryption key).
 * That reference is itself sealed with AES-GCM before it is written to the public Arkiv record,
 * so only Daak (and whoever Daak shows the photo to) can open it.
 */
const GATEWAY = process.env.SWARM_GATEWAY ?? "https://api.gateway.ethswarm.org";

export async function uploadPhoto(photo: Buffer): Promise<string> {
  const r = await fetch(`${GATEWAY}/bytes`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg", "Swarm-Encrypt": "true" },
    body: new Uint8Array(photo),
  });
  if (!r.ok) throw new Error(`Swarm ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return (await r.json()).reference as string;
}

const keyFor = (purpose: string) => createHash("sha256").update(`${env.masterSecret()}:${purpose}`).digest();
const key = () => keyFor("swarm-ref");

/** AES-GCM seal for anything private that must sit in a public record (photo references, phone, UPI ID). */
export function seal(text: string, purpose: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor(purpose), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function unseal(sealed: string, purpose: string): string {
  const b = Buffer.from(sealed, "base64");
  const d = createDecipheriv("aes-256-gcm", keyFor(purpose), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function sealRef(ref: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(ref, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function openRef(sealed: string): string {
  const b = Buffer.from(sealed, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export async function downloadPhoto(ref: string): Promise<ArrayBuffer> {
  const r = await fetch(`${GATEWAY}/bytes/${ref}`);
  if (!r.ok) throw new Error(`Swarm ${r.status}`);
  return r.arrayBuffer();
}
