// Registers a badge (an NFC serial) as a person: npx tsx --env-file=.env.local scripts/register-badge.mts <uid> <driver|sender|receiver> "<Name, route>" [vehicle]
import { putBadge, getBadge } from "../lib/arkiv.ts";

const [uid, role, name, vehicle = ""] = process.argv.slice(2);
if (!uid || !["driver", "sender", "receiver"].includes(role) || !name) {
  console.log('usage: register-badge.mts <uid> <driver|sender|receiver> "<Name, route>" [vehicle]');
  process.exit(1);
}
if (await getBadge(uid)) console.log("already registered:", uid);
else console.log("registered", uid, role, name, await putBadge({ uid, role, name, vehicle }));
