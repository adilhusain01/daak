"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteNav, ProofButton } from "@/components/site-nav";
import { arkivEntity, clock, hashscanTopic, isLate, verdictText, when } from "@/lib/ui";

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

/** One delivery, public: what happened at each stop and where the money went, with the proofs. */
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
  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <Link href="/live" className="mb-4 inline-flex rounded-lg bg-card-paper px-3 py-1.5 text-sm font-medium shadow-sm transition-transform active:scale-[0.97]">All deliveries</Link>
      {isLoading && <p className="text-muted-ink">Reading {code} from Arkiv and the Hedera log...</p>}
      {isError && <p className="text-held">No delivery with the code {code}.</p>}
      <div>
        {data && [data.delivery].map((d) => {
          const s = status(d);
          const byHop = new Map([...d.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h]));
          return (
            <section key={d.code} className="rounded-xl border border-rule bg-card-paper p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight">{d.code}</h1>
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
                        <span className="text-muted-ink">
                          {l.km ? `${l.km} km` : "pickup"}
                          {m && <span className={m.answer === "accept" ? "text-ok" : m.answer === "decline" ? "text-held" : ""}> · {m.answer === "accept" ? "driver accepted" : m.answer === "decline" ? "driver declined" : "waiting for the driver"}</span>}
                        </span>
                      </div>
                      {h ? <p className={`mt-1 ${v?.tone}`}>{v?.en}, {when(h.at)}</p>
                        : isLate(l.etaAt, false) ? <p className="mt-1 font-medium text-held">Running late: expected {clock(l.etaAt!)}</p>
                        : <p className="mt-1 text-muted-ink">{l.etaAt ? `Expected ${clock(l.etaAt)}` : "Not handed over yet"}{l.departsAt ? `, bus leaves ${clock(l.departsAt)}` : ""}</p>}
                      {h?.reason && <p className="text-muted-ink">{h.reason}</p>}
                      {m && (m.advanceRupees > 0
                        ? <p className="mt-1">Paid ₹{m.advanceRupees.toFixed(2)} at the handover ({m.pct}%), ₹{(m.heldRupees ?? 0).toFixed(2)} held until delivery</p>
                        : m.pct != null && <p className="mt-1 text-muted-ink">{m.pct}% of this stretch&apos;s pay at the handover, the rest after delivery</p>)}
                      {h && (
                        <span className="mt-2 flex flex-wrap gap-2">
                          {h.hcs && <ProofButton href={hashscanTopic(h.hcs)}>Hedera log</ProofButton>}
                          <ProofButton href={arkivEntity(h.key)}>Arkiv record</ProofButton>
                          {m?.tx && <ProofButton href={`https://hashscan.io/testnet/transaction/${m.tx}`}>Advance payment</ProofButton>}
                          {h.zgRequestId && <span className="self-center font-mono text-xs text-muted-ink" title={h.zgRequestId}>0G check {h.zgRequestId.replace(/^chatcmpl-/, "").slice(0, 8)}</span>}
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
