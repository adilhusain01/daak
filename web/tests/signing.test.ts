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
