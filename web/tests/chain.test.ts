// The server's files are read-only in production (Vercel). Once the escrow account and the dINR token exist,
// preparing a booking must only read data/chain.json, never write it: a booking failed with EROFS on 6 Nov.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("with the escrow and token already set up, setupMoney returns them without writing chain.json", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "daak-chain-"));
  mkdirSync(path.join(dir, "data"));
  const file = path.join(dir, "data", "chain.json");
  const ids = { topicId: "0.0.11327109", escrowId: "0.0.11327245", feeTokenId: "0.0.11327356" };
  writeFileSync(file, JSON.stringify(ids));
  chmodSync(file, 0o444);
  chmodSync(path.join(dir, "data"), 0o555);
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { setupMoney } = await import("../lib/payout.ts");
    const c = await setupMoney();
    assert.equal(c.escrowId, ids.escrowId);
    assert.equal(c.feeTokenId, ids.feeTokenId);
  } finally {
    process.chdir(cwd);
    chmodSync(path.join(dir, "data"), 0o755);
  }
});
