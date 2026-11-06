// Opens Daak's own 0G compute account (Direct) and sets 1 0G aside for the sealed vision provider, so the agent pays
// for its checks from its own wallet. Safe to run again: it only adds what is missing.
// npx tsx --env-file=.env.local scripts/zg-direct-setup.mts
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

const PROVIDER = process.env.ZG_VISION_PROVIDER_DIRECT ?? "0xf4FB8d2bD856e672b5f9848b0eD235A20079B250";
const w = new ethers.Wallet(process.env.ZG_PRIVATE_KEY!, new ethers.JsonRpcProvider(process.env.ZG_RPC ?? "https://evmrpc.0g.ai"));
const b = await createZGComputeNetworkBroker(w);
const bal = async () => ethers.formatEther(await w.provider!.getBalance(w.address));
console.log("wallet", w.address, await bal(), "0G");

const ledger = await b.ledger.getLedger().catch(() => null);
if (!ledger) { console.log("opening the compute account with 3 0G…"); await b.ledger.addLedger(3); }
const l = await b.ledger.getLedger();
console.log("compute account", JSON.stringify(l, (_k, v) => (typeof v === "bigint" ? ethers.formatEther(v) : v)));

const funded = (await b.ledger.getProvidersWithBalance("inference")).find(([p]) => p.toLowerCase() === PROVIDER.toLowerCase());
if (!funded || funded[1] < ethers.parseEther("1")) {
  console.log("setting 1 0G aside for", PROVIDER);
  await b.ledger.transferFund(PROVIDER, "inference", ethers.parseEther("1"));
}
console.log("providers with balance", (await b.ledger.getProvidersWithBalance("inference")).map(([p, a, c]) => [p, ethers.formatEther(a), ethers.formatEther(c)]));
await b.inference.acknowledgeProviderSigner(PROVIDER).then(() => console.log("provider's TEE signer acknowledged")).catch((e: Error) => console.log("acknowledge later:", e.message.slice(0, 140)));
console.log("wallet now", await bal(), "0G");
