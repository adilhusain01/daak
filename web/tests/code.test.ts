// The consignment code is written by hand on the lid. Daak, not the model, decides whether what the model read is
// that code: case, spaces and hyphens are how people write, not a different code. A handoff on 7 Nov was held
// because the lid read "KNP-3W-AE9" for KNP-3WAE9.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sameCode, recheckable } from "../lib/rules.ts";
import { parseAnswer } from "../lib/zg.ts";

test("a code written with extra hyphens, spaces or lower case is the same code", () => {
  assert.equal(sameCode("KNP-3W-AE9", "KNP-3WAE9"), true);
  assert.equal(sameCode("knp 3wae9", "KNP-3WAE9"), true);
  assert.equal(sameCode("KNP3WAE9", "KNP-3WAE9"), true);
});

test("a different code, or nothing read, is not a match", () => {
  assert.equal(sameCode("KNP-3WAE8", "KNP-3WAE9"), false);
  assert.equal(sameCode("KNP-1204", "KNP-3WAE9"), false);
  assert.equal(sameCode("", "KNP-3WAE9"), false);
});

test("the check's match comes from the code read, whatever the model's own match field says", () => {
  const held = parseAnswer('{"code_read":"KNP-3W-AE9","match":false,"condition":"intact","reason":"x"}', "KNP-3WAE9");
  assert.equal(held.match, true);
  const wrong = parseAnswer('{"code_read":"KNP-1204","match":true,"condition":"intact","reason":"x"}', "KNP-3WAE9");
  assert.equal(wrong.match, false);
});

test("0G may look again at unchecked stops, backup holds and code misreads, never at damage or wrong people", () => {
  assert.equal(recheckable("unchecked", "Tapped, not checked by AI."), true);
  assert.equal(recheckable("held", "Backup check: code unclear"), true);
  assert.equal(recheckable("held", 'Code on the parcel reads "KNP-3W-AE9", expected KNP-3WAE9.'), true);
  assert.equal(recheckable("held", "Parcel looks opened: tape cut"), false);
  assert.equal(recheckable("held", "These badges are not the drivers booked for this hop."), false);
  assert.equal(recheckable("green", "Code matches and the parcel looks intact."), false);
});
