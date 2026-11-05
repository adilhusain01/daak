// Creates escrow and the dINR token with its 2% custom fee: npx tsx --env-file=.env.local scripts/setup-money.mts
import { setupMoney, hashscan } from "../lib/payout.ts";
import { hedera } from "../lib/hedera.ts";

const c = await setupMoney();
console.log("escrow", c.escrowId, hashscan("account", c.escrowId!));
console.log("dINR", c.feeTokenId, hashscan("token", c.feeTokenId!));
hedera().close();
