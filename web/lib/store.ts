import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

/** Demo registry and handoff log on disk. The chain records are the source of truth; this file is the app's working copy. */
export type Badge = { name: string; role: "sender" | "driver" | "receiver"; vehicle?: string };
export type Leg = { hop: number; from: string; to: string; place: string };
export type Consignment = {
  code: string;
  parcel: string;
  label: string;
  route: Leg[];
  feeRupees: number;
  createdAt: number;
};
export type HandoffRecord = {
  code: string;
  hop: number;
  from: string;
  to: string;
  at: number;
  verdict: "green" | "held" | "unchecked";
  reason: string;
  photoSha256: string;
  zg?: { requestId?: string; verified?: boolean | null; model: string };
  hcs?: { topicId: string; sequence: string };
  arkiv?: { entityKey: string; txHash: string };
  errors: string[];
};
type Db = { badges: Record<string, Badge>; consignments: Consignment[]; handoffs: HandoffRecord[] };

const file = path.join(process.cwd(), "data", "db.json");

export function load(): Db {
  if (!existsSync(file)) return { badges: {}, consignments: [], handoffs: [] };
  return JSON.parse(readFileSync(file, "utf8"));
}

export function save(db: Db) {
  writeFileSync(file, JSON.stringify(db, null, 2));
}
