import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
const w = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!, new ethers.JsonRpcProvider(process.env.ZG_RPC ?? "https://evmrpc.0g.ai"));
const b = await createZGComputeNetworkBroker(w);
const s = await b.inference.listService();
for (const x of s as { provider: string; model: string; verifiability?: string; url?: string; serviceType?: string }[]) console.log(x.provider, x.model, x.verifiability, x.serviceType);
console.log("ledger:", await b.ledger.getLedger().then((l) => "exists").catch((e: Error) => e.message.slice(0, 80)));
