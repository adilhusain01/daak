// Publishes Daak's HCS-14 agent identity (the UAID and the fields it is computed from) on the public log, once:
//   npx tsx --env-file=.env.local scripts/agent-identity.mts
import { logHandoff } from "../lib/hedera.ts";
import { canonical, daakAgent, uaid } from "../lib/uaid.ts";

const a = daakAgent(process.env.HEDERA_OPERATOR_ID!);
const id = uaid(a);
console.log(id);
console.log(await logHandoff({ t: "daak.agent", standard: "HCS-14", uaid: id, fields: canonical(a), endpoint: "https://daak-ethglobal.vercel.app/.well-known/x402", supersedes: process.argv[2] ?? null }));
process.exit(0);
