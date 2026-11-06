// A handoff signed on a phone must verify, and any change to it, or another phone's key, must fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { handoffMessage, verifyHandoff } from "../lib/signing.ts";

const phone = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = phone.publicKey.export({ format: "der", type: "spki" }).toString("base64");
const h = { parcel: "04:aa", from: "04:23", to: "04:99", at: 1793900000000, photoSha256: "ab".repeat(32) };
const sig = sign("sha256", Buffer.from(handoffMessage(h)), phone.privateKey).toString("base64");

test("a handoff signed by the registered phone verifies", () => {
  assert.equal(verifyHandoff(pub, handoffMessage(h), sig), true);
});

test("changing who took the parcel, the time or the photo breaks the signature", () => {
  assert.equal(verifyHandoff(pub, handoffMessage({ ...h, to: "04:00" }), sig), false);
  assert.equal(verifyHandoff(pub, handoffMessage({ ...h, at: h.at + 1 }), sig), false);
  assert.equal(verifyHandoff(pub, handoffMessage({ ...h, photoSha256: "cd".repeat(32) }), sig), false);
});

test("another phone's key does not verify, and garbage does not crash", () => {
  const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
  assert.equal(verifyHandoff(other, handoffMessage(h), sig), false);
  assert.equal(verifyHandoff("not-a-key", handoffMessage(h), sig), false);
});

test("a phone's public key fits Arkiv's 128-byte text column", () => {
  assert.ok(pub.length <= 128);
});

// The taker's code: a QR their phone signs ("I am here, now"), which the giver scans instead of tapping a badge.
import { receiveMessage, checkReceiveProof } from "../lib/signing.ts";

const now = 1793950000000;
const taker = { uid: "g:3f9a01", issuedAt: now - 20_000, nonce: "n8x2k4q1" };
const proof = (t = taker, key = phone.privateKey) =>
  `DAAK1|${t.uid}|${t.issuedAt}|${t.nonce}|${sign("sha256", Buffer.from(receiveMessage(t)), key).toString("base64")}`;

test("a fresh code signed by the taker's phone proves the taker was there", () => {
  assert.deepEqual(checkReceiveProof(proof(), { to: taker.uid, devicePub: pub, now, used: new Set() }), { ok: true, nonce: taker.nonce });
});

test("a code for someone else, from another phone, or tampered with is refused", () => {
  assert.equal(checkReceiveProof(proof(), { to: "g:other", devicePub: pub, now, used: new Set() }).ok, false);
  const stranger = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey;
  assert.equal(checkReceiveProof(proof(taker, stranger), { to: taker.uid, devicePub: pub, now, used: new Set() }).ok, false);
  assert.equal(checkReceiveProof(proof().replace(String(taker.issuedAt), String(now)), { to: taker.uid, devicePub: pub, now, used: new Set() }).ok, false);
  assert.equal(checkReceiveProof("not a code", { to: taker.uid, devicePub: pub, now, used: new Set() }).ok, false);
});

test("a code older than two minutes, or used before, is refused", () => {
  const old = { ...taker, issuedAt: now - 3 * 60_000 };
  assert.equal(checkReceiveProof(proof(old), { to: taker.uid, devicePub: pub, now, used: new Set() }).ok, false);
  assert.equal(checkReceiveProof(proof(), { to: taker.uid, devicePub: pub, now, used: new Set([taker.nonce]) }).ok, false);
});

test("a taker with no registered phone cannot give a code", () => {
  assert.equal(checkReceiveProof(proof(), { to: taker.uid, devicePub: undefined, now, used: new Set() }).ok, false);
});
