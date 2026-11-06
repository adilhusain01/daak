// One real sealed check on a photo, the way a handoff runs it: Daak's own 0G account first, then the Router.
// npx tsx --env-file=.env.local scripts/zg-check.mts <photo.jpg> <expected code>
import { readFileSync } from "node:fs";
import { checkParcel } from "../lib/zg.ts";
const t = Date.now();
console.log(await checkParcel(readFileSync(process.argv[2]), process.argv[3] ?? "KNP-7115", "hop 1 at Lucknow", 30000, true), Date.now() - t, "ms");
