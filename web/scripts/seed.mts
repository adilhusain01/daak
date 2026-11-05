// Seeds one demo consignment for a parcel tag: npx tsx scripts/seed.mts <parcelUid> <receiverBadgeUid>
import { load, save } from "../lib/store.ts";

const [parcel = "test-parcel", receiver = "test-badge-b"] = process.argv.slice(2);
const db = load();
const driverA = "04:23:9b:52:1d:1c:91";
db.badges[receiver] ??= { name: "Suresh, Lucknow to Gorakhpur bus", role: "driver", vehicle: "UP-53-FT-4410" };
db.consignments = db.consignments.filter((c) => c.parcel !== parcel);
db.consignments.push({
  code: "KNP-0042",
  parcel,
  label: "Cotton shirts, 2 dozen, Kanpur to Gorakhpur",
  feeRupees: 180,
  createdAt: Date.now(),
  route: [
    { hop: 1, from: driverA, to: receiver, place: "Lucknow Charbagh bus stand" },
    { hop: 2, from: receiver, to: "retailer-gkp", place: "Gorakhpur, Ghosh Cloth House" },
  ],
});
db.handoffs = db.handoffs.filter((h) => h.code !== "KNP-0042");
save(db);
console.log("seeded KNP-0042 for parcel", parcel);
