"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Proposal = { action: "approve" | "recheck" | "pay_anyway" | "refund"; code: string; why: string };
type Reply = { answer: string; proposals: Proposal[]; toolsUsed: string[] };

const LABEL: Record<Proposal["action"], string> = { approve: "Approve and pay", recheck: "Recheck with 0G", pay_anyway: "Pay the drivers anyway", refund: "Refund the shop" };
const SUGGESTED = ["Which deliveries are late or held?", "What is each shop's balance?", "How much dINR is in escrow?"];

/** Runs a proposal through the same audited endpoint as the dashboard's own buttons. */
async function run(p: Proposal) {
  const post = (url: string, body: object) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const r = p.action === "approve" ? await post("/api/review", { code: p.code, reviewer: "operator via assistant" })
    : p.action === "recheck" ? await post("/api/recheck", { code: p.code })
    : await post("/api/resolve", { code: p.code, action: p.action === "pay_anyway" ? "pay" : "refund", reviewer: "operator via assistant" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Could not do it");
  return j;
}

/**
 * Ask Daak: questions answered from Daak's records and the Hedera network (through the Hedera Agent Kit's read-only
 * tools). It never moves money; what it suggests comes back as buttons the operator confirms.
 */
export function AssistantPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const askIt = useMutation({
    mutationFn: async (question: string) => {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "The assistant could not answer");
      return j as Reply;
    },
    onSuccess: (j) => { setReply(j); setConfirming(null); },
    onError: (e) => toast.error((e as Error).message),
  });
  const act = useMutation({
    mutationFn: run,
    onSuccess: (_j, p) => { toast.success(`${p.code}: ${LABEL[p.action].toLowerCase()} done`); setConfirming(null); qc.invalidateQueries({ queryKey: ["consignments"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = (text: string) => { const t = text.trim(); if (t) { setQ(t); askIt.mutate(t); } };
  return (
    <section className="mb-6 rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Ask Daak</h2>
      <p className="text-sm text-muted-ink">Answers come from Daak&apos;s records and the Hedera network, read through the Hedera Agent Kit. It never moves money: what it suggests comes back as a button you confirm.</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(q); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ask" className="sr-only">Question</label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which deliveries are late or held?"
          className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink" />
        <Button type="submit" className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" disabled={askIt.isPending}>{askIt.isPending ? "Checking..." : "Ask"}</Button>
      </form>
      {!reply && !askIt.isPending && (
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => submit(s)} className="rounded-md border border-rule bg-card-paper px-2.5 py-1 text-xs font-medium shadow-sm transition-transform active:scale-[0.97]">{s}</button>
          ))}
        </div>
      )}
      {reply && (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <p className="whitespace-pre-line">{reply.answer || "No answer."}</p>
          {reply.toolsUsed.length > 0 && <p className="text-xs text-muted-ink">Checked with: {reply.toolsUsed.join(", ")}</p>}
          {reply.proposals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {reply.proposals.map((p) => {
                const id = `${p.action}:${p.code}`;
                return confirming === id ? (
                  <Button key={id} className="rounded-lg bg-held text-paper shadow-sm active:translate-y-px" disabled={act.isPending} onClick={() => act.mutate(p)}>Confirm: {LABEL[p.action]} {p.code}</Button>
                ) : (
                  <Button key={id} variant="outline" title={p.why} className="rounded-lg shadow-sm active:translate-y-px" onClick={() => setConfirming(id)}>{LABEL[p.action]} {p.code}</Button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
