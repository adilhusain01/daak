"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { arkivEntity, hashscanTopic, verdictText, when, type HandoffView, type LegView } from "@/lib/ui";

type Row = {
  code: string; label: string; feeRupees: number; createdAt: number; schedule?: string; paidAt: number | null;
  route: (LegView & { from: string; to: string })[]; handoffs: HandoffView[];
};
type Data = { chain: { topicId?: string; feeTokenId?: string; escrowId?: string }; consignments: Row[] };

function status(r: Row) {
  if (r.paidAt) return { text: "Delivered, drivers paid", tone: "text-ok" };
  if (r.handoffs.some((h) => h.verdict === "held")) return { text: "Payment held", tone: "text-held" };
  const done = new Set(r.handoffs.map((h) => h.hop)).size;
  if (done === r.route.length) return { text: "Delivered, waiting for review", tone: "text-wait" };
  return { text: `In transit, ${done} of ${r.route.length} stops`, tone: "text-ink" };
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Data>({ queryKey: ["consignments"], queryFn: () => fetch("/api/consignments").then((r) => r.json()) });
  const approve = useMutation({
    mutationFn: async (code: string) => {
      const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, reviewer: "operator" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not approve");
      return j;
    },
    onSuccess: (_d, code) => { toast.success(`${code}: drivers paid`); qc.invalidateQueries({ queryKey: ["consignments"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Daak</h1>
        <p className="text-muted-ink">Every parcel, every handoff, every rupee owed to the drivers who carried it.</p>
      </header>

      {isLoading && <p className="text-muted-ink">Loading deliveries...</p>}
      {data && data.consignments.length === 0 && <p className="text-muted-ink">No deliveries booked yet.</p>}

      <div className="flex flex-col gap-4">
        {data?.consignments.map((r) => {
          const s = status(r);
          const byHop = new Map(r.handoffs.map((h) => [h.hop, h]));
          const reviewable = !r.paidAt && byHop.size === r.route.length && !r.handoffs.some((h) => h.verdict === "held");
          const totalKm = r.route.reduce((a, l) => a + (l.km ?? 0), 0);
          return (
            <section key={r.code} className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{r.code}</h2>
                  <p className="truncate text-sm text-muted-ink">{r.label}</p>
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className={`text-sm font-medium ${s.tone}`}>{s.text}</span>
                  <span className="text-sm text-muted-ink">₹{r.feeRupees} for {totalKm} km, booked {when(r.createdAt)}</span>
                </div>
              </div>

              <ol className="mt-4 flex flex-col gap-2">
                {r.route.map((l) => {
                  const h = byHop.get(l.hop);
                  const v = h ? verdictText[h.verdict] : null;
                  const share = totalKm ? Math.round((r.feeRupees * (l.km ?? 0) / totalKm) * 100) / 100 : 0;
                  return (
                    <li key={l.hop} className="rounded-lg border border-rule p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                        <span className="font-medium">Stop {l.hop}: {l.place}</span>
                        <span className="text-sm text-muted-ink">{l.km ?? "?"} km, driver share ₹{share}</span>
                      </div>
                      {h ? (
                        <div className="mt-1 flex flex-col gap-1 text-sm">
                          <span className={r.paidAt && h.verdict !== "held" ? "text-ok" : v?.tone}>{r.paidAt && h.verdict === "unchecked" ? "Approved by a reviewer and paid" : v?.en}, {when(h.at)}</span>
                          {h.reason && <span className="text-muted-ink">{h.reason}</span>}
                          <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted-ink">
                            {h.hcs && <a className="underline underline-offset-2" href={hashscanTopic(h.hcs)} target="_blank">Hedera log</a>}
                            <a className="underline underline-offset-2" href={arkivEntity(h.key)} target="_blank">Arkiv record</a>
                            {h.zgRequestId && <span>0G receipt {h.zgRequestId.slice(0, 10)}</span>}
                            {h.geo && <a className="underline underline-offset-2" href={`https://maps.google.com/?q=${h.geo.split(",").slice(0, 2).join(",")}`} target="_blank">Where</a>}
                          </span>
                        </div>
                      ) : (
                        <span className="mt-1 block text-sm text-muted-ink">Not handed over yet</span>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-ink">
                  <Link className="underline underline-offset-2" href={`/track/${r.code}`}>Customer tracking page</Link>
                  {r.schedule && <a className="underline underline-offset-2" href={`https://hashscan.io/testnet/schedule/${r.schedule}`} target="_blank">Scheduled payout</a>}
                </div>
                {reviewable && (
                  <Button className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" disabled={approve.isPending} onClick={() => approve.mutate(r.code)}>
                    {approve.isPending && approve.variables === r.code ? "Paying..." : "Approve and pay drivers"}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {data?.chain.topicId && (
        <footer className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-ink">
          <a className="underline underline-offset-2" href={`https://hashscan.io/testnet/topic/${data.chain.topicId}`} target="_blank">Public handoff log</a>
          {data.chain.feeTokenId && <a className="underline underline-offset-2" href={`https://hashscan.io/testnet/token/${data.chain.feeTokenId}`} target="_blank">Rupee credit token</a>}
          {data.chain.escrowId && <a className="underline underline-offset-2" href={`https://hashscan.io/testnet/account/${data.chain.escrowId}`} target="_blank">Escrow</a>}
        </footer>
      )}
    </main>
  );
}
