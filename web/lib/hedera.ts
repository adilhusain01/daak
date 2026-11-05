import { AccountId, Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

/** Public chain settings created by scripts (topic and token ids). Safe to commit. */
const chainFile = path.join(process.cwd(), "data", "chain.json");
export type Chain = { topicId?: string; feeTokenId?: string; escrowId?: string };
export function chain(): Chain {
  return existsSync(chainFile) ? JSON.parse(readFileSync(chainFile, "utf8")) : {};
}
export function saveChain(c: Chain) {
  writeFileSync(chainFile, JSON.stringify(c, null, 2));
}

let client: Client | null = null;
export function hedera(): Client {
  client ??= Client.forTestnet().setOperator(
    AccountId.fromString(env.hederaOperatorId()),
    PrivateKey.fromStringECDSA(env.hederaOperatorKey()),
  );
  return client;
}

export async function createTopic(memo: string): Promise<string> {
  const tx = await new TopicCreateTransaction().setTopicMemo(memo).setSubmitKey(PrivateKey.fromStringECDSA(env.hederaOperatorKey()).publicKey).execute(hedera());
  const receipt = await tx.getReceipt(hedera());
  return receipt.topicId!.toString();
}

/** Submits a message and returns at once with its transaction id; the sequence number comes from its receipt later. */
export async function submitLog(message: object) {
  const topicId = chain().topicId;
  if (!topicId) throw new Error("No HCS topic yet; run scripts/setup-hedera.mts");
  const res = await new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify(message)).execute(hedera());
  return {
    topicId,
    txId: res.transactionId.toString(),
    sequence: async () => (await res.getReceipt(hedera())).topicSequenceNumber!.toString(),
  };
}

/** Appends one handoff to the public, tamper-evident HCS log. Returns the sequence number. */
export async function logHandoff(message: object): Promise<{ topicId: string; sequence: string }> {
  const topicId = chain().topicId;
  if (!topicId) throw new Error("No HCS topic yet; run scripts/setup-hedera.ts");
  const tx = await new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(JSON.stringify(message)).execute(hedera());
  const receipt = await tx.getReceipt(hedera());
  return { topicId, sequence: receipt.topicSequenceNumber!.toString() };
}
