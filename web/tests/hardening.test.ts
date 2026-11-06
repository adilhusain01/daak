// Small hardening, written from the rules before the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { heldReasonHi, loginAllowed, mergeBySeq } from "../lib/rules.ts";
import { checkSignedAction } from "../lib/signing.ts";

test("a held handoff's reason is told in Hindi, matching what happened", () => {
  assert.match(heldReasonHi("These badges are not the drivers booked for this hop."), /बैज/);
  assert.match(heldReasonHi("Handoff happened 820 m from Lucknow, Charbagh bus stand."), /820 मीटर/);
  assert.match(heldReasonHi('Code on the parcel reads "KNP-1111", expected KNP-1204.'), /KNP-1111.*KNP-1204/);
  assert.match(heldReasonHi("Backup check (cloudflare, not sealed): parcel looks damaged. Payment held."), /फटा/);
  assert.match(heldReasonHi("This code has expired; ask for the new one on their screen."), /नया कोड/);
  assert.match(heldReasonHi("something we did not foresee"), /भुगतान रुका/);
});

const phone = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = phone.publicKey.export({ format: "der", type: "spki" }).toString("base64");
const now = 1793950000000;
const msg = `daak.job|KNP-1204|04:23|accept|${now - 5000}`;
const sig = sign("sha256", Buffer.from(msg), phone.privateKey).toString("base64");

test("an action by someone with a registered phone must be signed by it, and recent", () => {
  assert.equal(checkSignedAction({ devicePub: pub, message: msg, at: now - 5000, sig, now }), true);
  assert.equal(checkSignedAction({ devicePub: pub, message: msg, at: now - 5000, sig: undefined, now }), false);
  assert.equal(checkSignedAction({ devicePub: pub, message: msg.replace("accept", "decline"), at: now - 5000, sig, now }), false);
  assert.equal(checkSignedAction({ devicePub: pub, message: msg, at: now - 5000, sig, now: now + 20 * 60_000 }), false);
});

test("someone with no registered phone yet can still act (the first sign-in registers it)", () => {
  assert.equal(checkSignedAction({ devicePub: undefined, message: msg, at: now, sig: undefined, now }), true);
});

test("the operator passcode locks after 5 wrong tries in 15 minutes", () => {
  const t = 1793950000000;
  assert.equal(loginAllowed([t - 60_000, t - 50_000, t - 40_000, t - 30_000], t), true);
  assert.equal(loginAllowed([t - 60_000, t - 50_000, t - 40_000, t - 30_000, t - 20_000], t), false);
  assert.equal(loginAllowed([t - 20 * 60_000, t - 19 * 60_000, t - 18 * 60_000, t - 17 * 60_000, t - 16 * 60_000], t), true);
});

test("the cached log takes only new messages and never repeats one", () => {
  const a = [{ seq: 1, t: "a" }, { seq: 2, t: "b" }];
  assert.deepEqual(mergeBySeq(a, [{ seq: 2, t: "b" }, { seq: 3, t: "c" }]).map((m) => m.seq), [1, 2, 3]);
});

// The operator's sign-in: a session that expires and cannot be altered, not one fixed value forever.
import { operatorToken, verifyOperatorToken } from "../lib/auth.ts";

test("an operator session is signed, expires after 3 days, and ends when the passcode changes", () => {
  process.env.OPERATOR_PASSCODE = "test-pass"; process.env.DAAK_MASTER_SECRET = "test-secret";
  const t = 1793950000000;
  const tok = operatorToken(t);
  assert.notEqual(operatorToken(t), operatorToken(t + 1000));
  assert.equal(verifyOperatorToken(tok, t + 60_000), true);
  assert.equal(verifyOperatorToken(tok, t + 4 * 86_400_000), false);
  assert.equal(verifyOperatorToken(tok.replace(/^\d+/, String(t + 86_400_000)), t + 60_000), false);
  process.env.OPERATOR_PASSCODE = "new-pass";
  assert.equal(verifyOperatorToken(tok, t + 60_000), false);
});
