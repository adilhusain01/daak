// Writes demo badges and one consignment to Arkiv: npx tsx --env-file=.env.local scripts/seed.mts <parcelUid> <driverBUid>
import { putBadge, putConsignment, getBadge } from "../lib/arkiv.ts";

const [parcel = "test-parcel", driverB = "test-badge-b"] = process.argv.slice(2);
const driverA = "04:23:9b:52:1d:1c:91";
const retailer = "retailer-gkp";

for (const b of [
  { uid: driverA, name: "Ramesh, Kanpur to Lucknow bus", role: "driver", vehicle: "UP-78-AT-1123" },
  { uid: driverB, name: "Suresh, Lucknow to Gorakhpur bus", role: "driver", vehicle: "UP-53-FT-4410" },
  { uid: retailer, name: "Ghosh Cloth House, Gorakhpur", role: "receiver" },
]) {
  if (await getBadge(b.uid)) console.log("badge exists", b.uid);
  else console.log("badge", b.uid, await putBadge(b));
}

const code = `KNP-${String(Date.now()).slice(-4)}`;
console.log("consignment", code, await putConsignment({
  code, parcel, label: "Cotton shirts, 2 dozen, Kanpur to Gorakhpur", feeRupees: 180,
  route: [
    { hop: 1, from: driverA, to: driverB, place: "Lucknow Charbagh bus stand", km: 80 },
    { hop: 2, from: driverB, to: retailer, place: "Gorakhpur, Ghosh Cloth House", km: 270 },
  ],
}));
