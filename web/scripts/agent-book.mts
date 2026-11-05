// The sender's ordering agent: books a delivery and pays for it over x402 on Hedera, with no human.
// npx tsx --env-file=.env.local scripts/agent-book.mts <parcelUid> <driverBUid> [baseUrl]
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import { accountFor, keyFor } from "../lib/payout.ts";
import { hedera } from "../lib/hedera.ts";

const [parcel = "test-parcel", driverB = "test-badge-b", base = "http://localhost:3000"] = process.argv.slice(2);

// The agent has its own Hedera account; top it up from the operator if it runs low.
const agentId = await accountFor("sender-agent");
const bal = await (await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${agentId}`)).json();
if (bal.balance.balance < 3e8) {
  await (await new TransferTransaction().addHbarTransfer(process.env.HEDERA_OPERATOR_ID!, new Hbar(-5)).addHbarTransfer(agentId, new Hbar(5)).execute(hedera())).getReceipt(hedera());
}

const signer = createClientHederaSigner(agentId, keyFor("sender-agent"), { network: "hedera:testnet" });
// Spending controls: HBAR only, at most 2 HBAR per booking, and only ever paid to Daak's own account.
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "hedera:testnet", client: new ExactHederaScheme(signer) }],
  spendControls: { allowedAssets: [{ network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: String(2 * 100_000_000) }] },
  policies: [(_v, reqs) => reqs.filter((r) => r.payTo === process.env.HEDERA_OPERATOR_ID)],
});

const res = await pay(`${base}/api/book`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    parcel,
    label: "Cotton shirts, 2 dozen, Kanpur to Gorakhpur",
    feeRupees: 180,
    route: [
      { hop: 1, from: "04:23:9b:52:1d:1c:91", to: driverB, place: "Lucknow Charbagh bus stand", km: 80 },
      { hop: 2, from: driverB, to: "retailer-gkp", place: "Gorakhpur, Ghosh Cloth House", km: 270 },
    ],
  }),
});
console.log(res.status, res.headers.get("payment-response") ? "paid over x402" : "", await res.text());
hedera().close();
