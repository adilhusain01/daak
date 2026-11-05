// Creates the public HCS topic that logs every handoff. Run once: npx tsx --env-file=.env.local scripts/setup-hedera.mts
import { chain, createTopic, saveChain, hedera } from "../lib/hedera.ts";

const c = chain();
if (c.topicId) {
  console.log("topic already exists:", c.topicId);
} else {
  c.topicId = await createTopic("Daak handoff log");
  saveChain(c);
  console.log("created topic", c.topicId, `https://hashscan.io/testnet/topic/${c.topicId}`);
}
hedera().close();
