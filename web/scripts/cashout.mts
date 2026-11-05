// Redeems every driver's dINR on a delivered consignment and pays it to UPI: npx tsx --env-file=.env.local scripts/cashout.mts <code>
import { consignmentByCode } from "../lib/arkiv.ts";
import { cashOutAll } from "../lib/settle.ts";
import { hedera } from "../lib/hedera.ts";

const code = process.argv[2] ?? "KNP-7115";
const c = await consignmentByCode(code);
if (!c) throw new Error(`unknown ${code}`);
console.log(JSON.stringify(await cashOutAll(c), null, 1));
hedera().close();
