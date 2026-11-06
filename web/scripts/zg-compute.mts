// Daak's own 0G compute account, and one top-up decision as a booking would make it.
// npx tsx --env-file=.env.local scripts/zg-compute.mts [run]
import { computeAccount, fundCompute } from "../lib/compute.ts";
const { b: _b, ...a } = await computeAccount();
console.log("now", a);
if (process.argv[2] === "run") console.log("after a booking", await fundCompute(process.argv[3] ?? "TEST", Number(process.argv[4] ?? 22.14)));
