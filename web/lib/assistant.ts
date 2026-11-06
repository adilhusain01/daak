import { generateText, stepCountIs, tool } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import { coreAccountQueryPlugin, coreConsensusQueryPlugin, coreTokenQueryPlugin, coreTransactionQueryPlugin } from "@hashgraph/hedera-agent-kit/plugins";
import { HederaAIToolkit } from "@hashgraph/hedera-agent-kit-ai-sdk";
import { badgesByRole, handoffsFor, recentConsignments } from "./arkiv";
import { chain, hedera } from "./hedera";
import { shopBalance } from "./shop";
import { holdbackStatus } from "./split";
import { readLog } from "./history";
import { clock, isLate } from "./timetable";

/**
 * Daak's operator assistant. It answers questions about deliveries and money by reading Daak's records and the
 * Hedera network: Hedera reads go through the Hedera Agent Kit's query tools only (balances, accounts, tokens,
 * HCS topic messages, transaction records), so it cannot move money. Anything that would move money comes back
 * as a proposal the operator confirms with a button, which calls the normal, audited endpoint.
 */
export type Proposal = { action: "approve" | "recheck" | "pay_anyway" | "refund"; code: string; why: string };

const model = () => {
  const cf = createOpenAICompatible({
    name: "cloudflare",
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1`,
    apiKey: process.env.CF_AI_TOKEN,
  });
  return cf(process.env.ASSISTANT_MODEL ?? "@cf/mistralai/mistral-small-3.1-24b-instruct");
};

export const assistantReady = () => Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN);

export async function ask(question: string) {
  const c = chain();
  const proposals: Proposal[] = [];
  const hak = new HederaAIToolkit({
    client: hedera(),
    configuration: {
      plugins: [coreAccountQueryPlugin, coreTokenQueryPlugin, coreConsensusQueryPlugin, coreTransactionQueryPlugin],
      context: { mode: AgentMode.AUTONOMOUS },
    },
  });
  const daak = {
    list_deliveries: tool({
      description: "Recent Daak deliveries: code, route, stops handed over, held or late stops, fee, and whether the held pay has released.",
      inputSchema: z.object({}),
      execute: async () => {
        const since = Number(process.env.DATA_SINCE ?? 0);
        const log = await readLog();
        const list = (await recentConsignments()).filter((x) => x.createdAt >= since).slice(0, 10);
        return Promise.all(list.map(async (x) => {
          const hs = await handoffsFor(x.code);
          const latest = new Map([...hs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));
          return {
            code: x.code, label: x.label, feeRupees: x.feeRupees,
            stops: x.route.map((l) => ({
              hop: l.hop, place: l.place.split(",")[0], verdict: latest.get(l.hop) ?? "not yet",
              eta: l.etaAt ? clock(l.etaAt) : null, late: isLate(l.etaAt, latest.has(l.hop)),
            })),
            heldPay: await holdbackStatus(x.code, log),
          };
        }));
      },
    }),
    shop_balances: tool({
      description: "Every sending shop's prepaid rupee balance and its agent's Hedera account.",
      inputSchema: z.object({}),
      execute: async () => Promise.all((await badgesByRole("sender")).map(async (s) => ({ shop: s.name, ...(await shopBalance(s.uid)) }))),
    }),
    propose_action: tool({
      description: "Propose an action for the operator to confirm. Never claim it is done. approve: pay handed-over stops that were not checked by AI. recheck: send unchecked photos to 0G again. pay_anyway or refund: settle a held delivery.",
      inputSchema: z.object({ action: z.enum(["approve", "recheck", "pay_anyway", "refund"]), code: z.string(), why: z.string() }),
      execute: async (p) => { proposals.push(p); return { proposed: true, note: "The operator must confirm with the button." }; },
    }),
  };
  const r = await generateText({
    model: model(),
    system:
      "You are Daak's operator assistant. Daak relays parcels across buses in UP and Bihar and pays drivers by the km on Hedera. " +
      "Answer in two to five short plain sentences, in rupees, with parcel codes. Call a tool for every fact; state only numbers a tool returned, " +
      "and if no tool gave a number, say you could not check it. Token balances from Hedera tools are in the token's smallest unit: dINR has 2 decimals. " +
      "You cannot move money: to suggest a payment, refund or recheck, call propose_action and say the operator can confirm it. " +
      `Hedera testnet ids: public log topic ${c.topicId}, rupee credit token dINR ${c.feeTokenId} (2 decimals), escrow account ${c.escrowId}, Daak treasury ${process.env.HEDERA_OPERATOR_ID}.`,
    prompt: question,
    tools: { ...hak.getTools(), ...daak },
    stopWhen: stepCountIs(6),
  });
  const toolsUsed = [...new Set(r.steps.flatMap((s) => s.content.flatMap((p) => (p.type === "tool-call" || p.type === "tool-result" ? [p.toolName] : []))))];
  // The buttons also come from the real state of every delivery the answer mentions, not only from the model.
  for (const code of new Set(r.text.match(/KNP-\d{4}/g) ?? [])) {
    const hs = await handoffsFor(code).catch(() => []);
    const latest = new Map([...hs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));
    const verdicts = [...latest.values()];
    if (verdicts.includes("held")) {
      proposals.push({ action: "recheck", code, why: "A stop is held; 0G's sealed check can clear or confirm it." });
      proposals.push({ action: "pay_anyway", code, why: "The photo shows the parcel was fine." });
      proposals.push({ action: "refund", code, why: "The parcel was lost or damaged." });
    } else if (verdicts.includes("unchecked")) {
      proposals.push({ action: "recheck", code, why: "Stops were not checked by AI." });
      proposals.push({ action: "approve", code, why: "Pay the handed-over stops after looking at the photos." });
    }
  }
  const unique = [...new Map(proposals.map((p) => [`${p.action}:${p.code}`, p])).values()];
  // Keep the model's own words, minus any tool call it wrote out as text instead of making.
  const answer = r.text.replace(/\[?propose_action\([^)]*\)\]?/g, "").trim();
  return { answer, proposals: unique, toolsUsed };
}
