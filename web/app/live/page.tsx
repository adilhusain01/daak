"use client";

import { useQuery } from "@tanstack/react-query";
import { SiteNav, ProofButton } from "@/components/site-nav";
import { arkivEntity, hashscanTopic, verdictText, when } from "@/lib/ui";

type H = { key: string; hop: number; verdict: string; place: string; at: number; reason: string; hcs: string; zgRequestId: string };
type M = { hop: number; km: number; pct: number | null; advanceRupees: number; heldRupees: number | null; tx: string | null };
type D = {
  code: string; label: string; createdAt: number; feeRupees: number; weight: string; km: number;
  route: { hop: number; place: string; km: number }[]; handoffs: H[]; money: M[];
  holdback: { schedule: string; releasesAt: number | null; rupees: number; executedAt: number | null; deleted: boolean } | null;
};

function status(d: D) {
  const latest = new Map([...d.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));
  if (d.holdback?.deleted) return { text: "Claim settled, shop refunded", tone: "text-held" };
  if (d.holdback?.executedAt) return { text: "Delivered, drivers paid in full", tone: "text-ok" };
  if (d.holdback) return { text: `Delivered, held pay releases ${when(d.holdback.releasesAt ?? 0)}`, tone: "text-ok" };
  if ([...latest.values()].includes("held")) return { text: "Payment held for a check", tone: "text-held" };
  return { text: `On the way, ${latest.size} of ${d.route.length} stops`, tone: "text-ink" };
}

/** The public view of every delivery: what happened at each stop and where the money went, with the proofs. */
export default function Live() {
  const { data, isLoading } = useQuery<{ chain: { topicId?: string; feeTokenId?: string; escrowId?: string }; deliveries: D[] }>({
    queryKey: ["live"], queryFn: () => fetch("/api/live").then((r) => r.json()), refetchInterval: 20000,
  });
  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <div className="mb-6 grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
        <header className="flex flex-col gap-1 lg:col-span-8">
          <h1 className="text-3xl font-semibold tracking-tight">Live deliveries</h1>
          <p className="max-w-3xl text-muted-ink">
            Every delivery on Daak, read from Arkiv and the public Hedera log: each stop&apos;s check, what each driver was paid at the handover and what is held until delivery.
            Photos, phone numbers and payment details stay private.
          </p>
        </header>
        {data?.chain.topicId && (
          <div className="flex flex-wrap gap-2 lg:col-span-4 lg:justify-end">
            <ProofButton href={`https://hashscan.io/testnet/topic/${data.chain.topicId}`}>Public handoff log</ProofButton>
            {data.chain.feeTokenId && <ProofButton href={`https://hashscan.io/testnet/token/${data.chain.feeTokenId}`}>Rupee credit token</ProofButton>}
            {data.chain.escrowId && <ProofButton href={`https://hashscan.io/testnet/account/${data.chain.escrowId}`}>Escrow</ProofButton>}
          </div>
        )}
      </div>
      {isLoading && <p className="text-muted-ink">Reading Arkiv and the Hedera log...</p>}
      {data && !data.deliveries.length && <p className="text-muted-ink">No deliveries yet today.</p>}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {data?.deliveries.map((d) => {
          const s = status(d);
          const byHop = new Map([...d.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h]));
          return (
            <section key={d.code} className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{d.code}</h2>
                  <p className="truncate text-sm text-muted-ink">{d.label}</p>
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className={`text-sm font-medium ${s.tone}`}>{s.text}</span>
                  <span className="text-sm text-muted-ink">₹{d.feeRupees.toFixed(2)} to drivers · {d.km} km · {d.weight} · {when(d.createdAt)}</span>
                </div>
              </div>
              <ol className="mt-4 flex flex-col gap-2">
                {d.route.map((l) => {
                  const h = byHop.get(l.hop);
                  const m = d.money.find((x) => x.hop === l.hop);
                  const v = h ? verdictText[h.verdict] : null;
                  return (
                    <li key={l.hop} className="rounded-lg border border-rule p-3 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                        <span className="font-medium">Stop {l.hop}: {l.place}</span>
                        <span className="text-muted-ink">{l.km ? `${l.km} km` : "pickup"}</span>
                      </div>
                      {h ? <p className={`mt-1 ${v?.tone}`}>{v?.en}, {when(h.at)}</p> : <p className="mt-1 text-muted-ink">Not handed over yet</p>}
                      {h?.reason && <p className="text-muted-ink">{h.reason}</p>}
                      {m && (m.advanceRupees > 0
                        ? <p className="mt-1">Paid ₹{m.advanceRupees.toFixed(2)} at the handover ({m.pct}%), ₹{(m.heldRupees ?? 0).toFixed(2)} held until delivery</p>
                        : m.pct != null && <p className="mt-1 text-muted-ink">{m.pct}% of this stretch&apos;s pay at the handover, the rest after delivery</p>)}
                      {h && (
                        <span className="mt-2 flex flex-wrap gap-2">
                          {h.hcs && <ProofButton href={hashscanTopic(h.hcs)}>Hedera log</ProofButton>}
                          <ProofButton href={arkivEntity(h.key)}>Arkiv record</ProofButton>
                          {m?.tx && <ProofButton href={`https://hashscan.io/testnet/transaction/${m.tx}`}>Advance payment</ProofButton>}
                          {h.zgRequestId && <span className="self-center text-xs text-muted-ink">0G receipt {h.zgRequestId.slice(0, 10)}</span>}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {d.holdback && (
                <p className="mt-3 text-sm">
                  Held pay ₹{d.holdback.rupees.toFixed(2)}: {d.holdback.deleted ? "cancelled by a claim" : d.holdback.executedAt ? `released on chain ${when(d.holdback.executedAt)}` : `a scheduled transfer that releases itself ${when(d.holdback.releasesAt ?? 0)}`}{" "}
                  <a className="font-medium underline underline-offset-2" href={`https://hashscan.io/testnet/schedule/${d.holdback.schedule}`} target="_blank" rel="noreferrer">schedule</a>
                </p>
              )}
              <div className="mt-3"><ProofButton href={`/track/${d.code}`}>Customer tracking page</ProofButton></div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
