// The sender's ordering agent: books a delivery and pays for it over x402 on Hedera, with no human.
// npx tsx --env-file=.env.local scripts/agent-book.mts <parcelUid> <driverBUid> [baseUrl]
import { agentBook } from "../lib/agent.ts";
import { hedera } from "../lib/hedera.ts";

const [parcel = "test-parcel", driverB = "test-badge-b", base = "http://localhost:3000"] = process.argv.slice(2);
const r = await agentBook(base, {
  parcel,
  label: "Cotton shirts, 2 dozen, Kanpur to Gorakhpur",

  route: [
    { hop: 1, from: "04:23:9b:52:1d:1c:91", to: driverB, place: "Lucknow Charbagh bus stand", km: 80 },
    { hop: 2, from: driverB, to: "retailer-gkp", place: "Gorakhpur, Ghosh Cloth House", km: 270 },
  ],
});
console.log(JSON.stringify(r));
hedera().close();
