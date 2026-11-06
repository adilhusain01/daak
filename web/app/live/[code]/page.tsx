"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteNav, ProofButton, Page } from "@/components/site-nav";
import { RouteSteps, PayBar, type StopState } from "@/components/route-steps";
import { arkivEntity, clock, hashscanTopic, isLate, when } from "@/lib/ui";

type H = { key: string; hop: number; verdict: string; place: string; at: number; reason: string; hcs: string; zgRequestId: string };
type M = { hop: number; km: number; pct: number | null; advanceRupees: number; heldRupees: number | null; tx: string | null; answer: string | null };
type D = {
  code: string; label: string; createdAt: number; feeRupees: number; weight: string; km: number;
  route: { hop: number; place: string; km: number; departsAt: number | null; etaAt: number | null }[]; handoffs: H[]; money: M[];
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

/** One delivery, public: the stops as a picture, then each stop's pay and proofs. */
export default function LiveParcelRoute() {
  return <Suspense><LiveParcel /></Suspense>;
}

function LiveParcel() {
  const code = decodeURIComponent(String(useParams<{ code: string }>().code)).toUpperCase();
  const { data, isLoading, isError } = useQuery<{ chain: { topicId?: string; feeTokenId?: string; escrowId?: string }; delivery: D }>({
    queryKey: ["live-parcel", code],
    queryFn: async () => { const r = await fetch(`/api/live/${encodeURIComponent(code)}`); if (!r.ok) throw new Error(String(r.status)); return r.json(); },
    refetchInterval: 20000,
  });
  const d = data?.delivery;
  const byHop = d ? new Map([...d.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h])) : new Map<number, H>();
  const firstOpen = d?.route.find((l) => !byHop.has(l.hop))?.hop;
  const s = d && status(d);

  return (
    <Page>
      <SiteNav />
      <Link href="/live" className="mb-8 inline-flex text-sm font-semibold text-soft-ink hover:text-ink">← All deliveries</Link>
      {isLoading && <p className="text-muted-ink">Reading {code} from Arkiv and the Hedera log...</p>}
      {isError && <p className="text-held">No delivery with the code {code}.</p>}
      {d && s && (
        <div className="flex flex-col gap-14">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-mono text-4xl font-medium tracking-tight sm:text-5xl">{d.code}</h1>
              <p className="mt-2 text-lg text-soft-ink">{d.label}</p>
            </div>
            <div className="flex flex-col gap-1 lg:items-end">
              <p className={`font-display text-2xl font-semibold ${s.tone}`}>{s.text}</p>
              <p className="font-mono text-sm text-muted-ink">₹{d.feeRupees.toFixed(2)} · {d.km} km · {d.weight} · {when(d.createdAt)}</p>
            </div>
          </header>

          <RouteSteps stops={d.route.map((l) => {
            const h = byHop.get(l.hop);
            const state: StopState = h ? (h.verdict as StopState) : l.hop === firstOpen ? "next" : "later";
            const note = h ? when(h.at) : isLate(l.etaAt, false) ? `Running late, expected ${clock(l.etaAt!)}` : l.etaAt ? `Expected ${clock(l.etaAt)}` : undefined;
            return { hop: l.hop, place: l.place, km: l.km, state, note };
          })} />

          <section aria-label="Each stop" className="grid grid-cols-1 gap-x-10 border-t border-rule md:grid-cols-2 xl:grid-cols-3">
            {d.route.map((l) => {
              const h = byHop.get(l.hop);
              const m = d.money.find((x) => x.hop === l.hop);
              return (
                <article key={l.hop} className="flex flex-col gap-3 border-b border-rule py-6">
                  <p className="font-display text-xl font-semibold">Stop {l.hop}, {l.place.split(",")[0]}</p>
                  {m && m.advanceRupees > 0 && <PayBar now={m.advanceRupees} held={m.heldRupees ?? 0} label={`${m.pct}% at the handover`} />}
                  {m && !(m.advanceRupees > 0) && m.pct != null && <p className="text-sm text-soft-ink">{m.pct}% of this stretch at the handover, the rest after delivery</p>}
                  {m?.answer && <p className={`text-sm ${m.answer === "accept" ? "text-ok" : "text-held"}`}>{m.answer === "accept" ? "Driver accepted the job" : "Driver declined the job"}</p>}
                  {h?.reason && <p className="text-sm text-soft-ink">{h.reason}</p>}
                  {h && (
                    <div className="flex flex-wrap items-center gap-2">
                      {h.hcs && <ProofButton href={hashscanTopic(h.hcs)}>Hedera log</ProofButton>}
                      <ProofButton href={arkivEntity(h.key)}>Arkiv record</ProofButton>
                      {m?.tx && <ProofButton href={`https://hashscan.io/testnet/transaction/${m.tx}`}>Payment</ProofButton>}
                      {h.zgRequestId && <span className="font-mono text-xs text-muted-ink" title={h.zgRequestId}>0G {h.zgRequestId.replace(/^chatcmpl-/, "").slice(0, 8)}</span>}
                    </div>
                  )}
                  {!h && <p className="text-sm text-muted-ink">Not handed over yet</p>}
                </article>
              );
            })}
          </section>

          <footer className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {d.holdback ? (
              <p className="text-soft-ink">
                Held pay <span className="font-mono text-ink">₹{d.holdback.rupees.toFixed(2)}</span>:{" "}
                {d.holdback.deleted ? "cancelled by a claim" : d.holdback.executedAt ? `released on chain ${when(d.holdback.executedAt)}` : `releases itself ${when(d.holdback.releasesAt ?? 0)}`}
              </p>
            ) : <span />}
            <div className="flex flex-wrap gap-2">
              {d.holdback && <ProofButton href={`https://hashscan.io/testnet/schedule/${d.holdback.schedule}`}>Held pay schedule</ProofButton>}
              <ProofButton href={`/track/${d.code}`}>Customer tracking page</ProofButton>
            </div>
          </footer>
        </div>
      )}
    </Page>
  );
}
