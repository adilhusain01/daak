// A booking writes its record first and locks the fee second. If the fee step fails, the shop is not charged
// (x402 settles only on success), so the record must not stay behind: a ghost booking appeared on 6 Nov this way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { orUndo } from "../lib/undo.ts";

test("when the next step fails, the record just written is removed and the error still reaches the caller", async () => {
  const undone: string[] = [];
  await assert.rejects(
    orUndo("0xabc", async () => { throw new Error("escrow down"); }, async (k) => { undone.push(k); }),
    /escrow down/,
  );
  assert.deepEqual(undone, ["0xabc"]);
});

test("when the next step works, nothing is removed and its result comes back", async () => {
  const undone: string[] = [];
  const r = await orUndo("0xabc", async () => 42, async (k) => { undone.push(k); });
  assert.equal(r, 42);
  assert.deepEqual(undone, []);
});

test("if removing the record fails too, the original error is the one reported", async () => {
  await assert.rejects(
    orUndo("0xabc", async () => { throw new Error("escrow down"); }, async () => { throw new Error("arkiv down"); }),
    /escrow down/,
  );
});
