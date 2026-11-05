// Checks the 0G compute account and runs one real sealed vision check on a photo:
// npx tsx --env-file=.env.local scripts/setup-0g.mts <photo.jpg>
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { checkParcel } from "../lib/zg.ts";

const wallet = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!, new ethers.JsonRpcProvider(process.env.ZG_RPC ?? "https://evmrpc.0g.ai"));
const broker = await createZGComputeNetworkBroker(wallet);
console.log("wallet", wallet.address, ethers.formatEther(await wallet.provider!.getBalance(wallet.address)), "0G");
try {
  const l = await broker.ledger.getLedger();
  console.log("ledger", JSON.stringify(l, (_k, v) => (typeof v === "bigint" ? ethers.formatEther(v) : v)));
} catch (e) {
  console.log("no ledger yet:", (e as Error).message.slice(0, 120));
}
const provider = process.env.ZG_VISION_PROVIDER ?? "0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0";
await broker.inference.acknowledgeProviderSigner(provider).catch((e: Error) => console.log("acknowledge:", e.message.slice(0, 120)));
const photo = process.argv[2];
if (photo) console.log("check", await checkParcel(readFileSync(photo), "KNP-7115", "hop 1 at Lucknow"));
