// A page that asks for a parcel code that does not exist must say so at once: a 404 will not change on a retry.
// Network blips and server errors are worth one or two more tries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRetry } from "../lib/retry.ts";

test("a 4xx answer is never retried", () => {
  assert.equal(shouldRetry(0, new Error("404")), false);
  assert.equal(shouldRetry(0, new Error("401")), false);
});

test("a server error or a dropped connection is retried at most twice", () => {
  assert.equal(shouldRetry(0, new Error("503")), true);
  assert.equal(shouldRetry(1, new Error("Failed to fetch")), true);
  assert.equal(shouldRetry(2, new Error("503")), false);
});
