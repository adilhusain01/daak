"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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

type Msg = { id: number; role: "you" | "daak"; text: string; proposals?: Proposal[]; toolsUsed?: string[] };

/**
 * Ask Daak: a chat that floats over the operator's pages from a key at the bottom right. Answers come from
 * Daak's records and the Hedera network (the Hedera Agent Kit's read-only tools). It never moves money:
 * what it suggests comes back as buttons the operator confirms.
 */
export function AssistantChat() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const askIt = useMutation({
    mutationFn: async (question: string) => {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "The assistant could not answer");
      return j as Reply;
    },
    onSuccess: (j) => { setMsgs((m) => [...m, { id: Date.now(), role: "daak", text: j.answer || "No answer.", proposals: j.proposals, toolsUsed: j.toolsUsed }]); setConfirming(null); },
    onError: (e) => setMsgs((m) => [...m, { id: Date.now(), role: "daak", text: (e as Error).message }]),
  });
  const act = useMutation({
    mutationFn: run,
    onSuccess: (_j, p) => {
      toast.success(`${p.code}: ${LABEL[p.action].toLowerCase()} done`); setConfirming(null);
      qc.invalidateQueries({ queryKey: ["ops-list"] }); qc.invalidateQueries({ queryKey: ["ops-parcel"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = (text: string) => {
    const t = text.trim();
    if (!t || askIt.isPending) return;
    setMsgs((m) => [...m, { id: Date.now(), role: "you", text: t }]);
    setQ("");
    askIt.mutate(t);
  };

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, askIt.isPending]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="ask-daak"
        className="fixed right-4 bottom-4 z-40 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-paper shadow-lg transition-transform active:scale-[0.97] sm:right-6 sm:bottom-6">
        {open ? "Close" : "Ask Daak"}
      </button>

      <section id="ask-daak" role="dialog" aria-label="Ask Daak" inert={!open}
        className={`fixed right-4 bottom-20 z-40 flex h-[min(36rem,calc(100dvh-7rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-rule bg-card-paper shadow-xl transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none sm:right-6 sm:bottom-22 sm:w-[28rem] ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
        <header className="border-b border-rule px-4 py-3">
          <h2 className="font-semibold">Ask Daak</h2>
          <p className="text-xs text-muted-ink">Reads Daak&apos;s records and Hedera through the Hedera Agent Kit. It never moves money; suggestions come back as buttons you confirm.</p>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 text-sm">
          {!msgs.length && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-muted-ink">Try one of these:</p>
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => submit(s)} className="rounded-md border border-rule bg-paper px-2.5 py-1.5 text-left text-xs font-medium shadow-sm transition-transform active:scale-[0.97]">{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`flex flex-col gap-2 ${m.role === "you" ? "items-end" : "items-start"}`}>
              <p className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 ${m.role === "you" ? "bg-ink text-paper" : "bg-paper"}`}>{m.text}</p>
              {!!m.toolsUsed?.length && <p className="text-xs text-muted-ink">Checked with: {m.toolsUsed.join(", ")}</p>}
              {!!m.proposals?.length && (
                <div className="flex flex-wrap gap-2">
                  {m.proposals.map((p) => {
                    const id = `${m.id}:${p.action}:${p.code}`;
                    return confirming === id ? (
                      <Button key={id} size="sm" className="rounded-lg bg-held text-paper shadow-sm active:translate-y-px" disabled={act.isPending} onClick={() => act.mutate(p)}>Confirm: {LABEL[p.action]} {p.code}</Button>
                    ) : (
                      <Button key={id} size="sm" variant="outline" title={p.why} className="rounded-lg shadow-sm active:translate-y-px" onClick={() => setConfirming(id)}>{LABEL[p.action]} {p.code}</Button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {askIt.isPending && <p className="self-start rounded-lg bg-paper px-3 py-2 text-muted-ink">Checking Daak&apos;s records and Hedera...</p>}
          <div ref={end} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(q); }} className="flex gap-2 border-t border-rule p-3">
          <label htmlFor="ask" className="sr-only">Question</label>
          <input id="ask" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which deliveries are late or held?"
            className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink" />
          <Button type="submit" className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" disabled={askIt.isPending || !q.trim()}>Ask</Button>
        </form>
      </section>
    </>
  );
}
