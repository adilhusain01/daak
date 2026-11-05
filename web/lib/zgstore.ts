import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { env } from "./env";

/**
 * The episode log 0G asks for: every checkpoint decision (including "not checked") is written to
 * 0G Storage as a small JSON record, so the decision and its request id can be fetched by root hash.
 * Mainnet by default; ZG_STORAGE_NETWORK=testnet uses Galileo with ZG_STORAGE_KEY.
 */
const NET = process.env.ZG_STORAGE_NETWORK === "testnet"
  ? { rpc: "https://evmrpc-testnet.0g.ai", indexer: "https://indexer-storage-testnet-turbo.0g.ai", key: () => process.env.ZG_STORAGE_KEY ?? env.zgKey() }
  : { rpc: env.zgRpc(), indexer: "https://indexer-storage-turbo.0g.ai", key: () => env.zgKey() };

export async function logDecision(record: object): Promise<{ rootHash: string; tx: string; network: string }> {
  const data = new MemData(new TextEncoder().encode(JSON.stringify(record)));
  const [tree, treeErr] = await data.merkleTree();
  if (treeErr || !tree) throw new Error(`0G Storage tree: ${treeErr}`);
  const signer = new ethers.Wallet(NET.key(), new ethers.JsonRpcProvider(NET.rpc));
  const [tx, err] = await new Indexer(NET.indexer).upload(data, NET.rpc, signer);
  if (err) throw new Error(`0G Storage upload: ${err}`);
  const txHash = typeof tx === "object" && tx && "txHash" in tx ? String((tx as { txHash: string }).txHash) : String(tx);
  return { rootHash: tree.rootHash() ?? "", tx: txHash, network: process.env.ZG_STORAGE_NETWORK === "testnet" ? "galileo" : "mainnet" };
}
