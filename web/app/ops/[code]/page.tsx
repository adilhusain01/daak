"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteNav, ProofButton } from "@/components/site-nav";
import { UpiPay } from "@/components/upi-pay";
import { AssistantChat } from "@/components/assistant-panel";
import { Suspense, useState } from "react";
import { arkivEntity, clock, hashscanTopic, isLate, when, type HandoffView, type LegView } from "@/lib/ui";
import { RouteSteps, PayBar, type StopState } from "@/components/route-steps";

type Money = { hop: number; account: string; upiRupees: number; upiStatus: string | null; utr: string | null; bachatRupees: number; advanceRupees: number; advancePct: number | null; heldRupees: number | null; answer: string | null };
type Holdback = { schedule: string; releasesAt: number | null; rupees: number; executedAt: number | null; deleted: boolean };
type Row = {
  code: string; label: string; feeRupees: number; createdAt: number; schedule?: string; paidAt: number | null; km: number; meter: string; money: Money[]; holdback: Holdback | null;
  route: (LegView & { from: string; to: string; advancePct?: number; departsAt?: number; etaAt?: number })[]; handoffs: HandoffView[];
};
type Data = { chain: { topicId?: string; feeTokenId?: string; escrowId?: string }; parcel: Row };

function status(r: Row) {
  if (r.holdback?.deleted) return { text: "Claim settled, shop refunded", tone: "text-held" };
  if (r.holdback?.executedAt) return { text: "Delivered, drivers paid in full", tone: "text-ok" };
  if (r.holdback) return { text: `Delivered, holdbacks release ${when(r.holdback.releasesAt ?? 0)}`, tone: "text-ok" };
  if (r.paidAt) return { text: "Delivered, drivers paid", tone: "text-ok" };
  const latest = new Map([...r.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));
  if ([...latest.values()].includes("held")) return { text: "Payment held", tone: "text-held" };
  const done = latest.size;
  if (done === r.route.length) return { text: "Delivered, waiting for review", tone: "text-wait" };
  return { text: `In transit, ${done} of ${r.route.length} stops`, tone: "text-ink" };
}

/** One parcel for the operator: every stop with its proofs, where the money went, and the actions it needs. */
export default function ParcelPageRoute() {
  return <Suspense><ParcelPage /></Suspense>;
}

function ParcelPage() {
  const code = decodeURIComponent(String(useParams<{ code: string }>().code)).toUpperCase();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<Data>({
    queryKey: ["ops-parcel", code],
    queryFn: async () => { const r = await fetch(`/api/consignments/${encodeURIComponent(code)}`); if (!r.ok) throw new Error(String(r.status)); return r.json(); },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops-parcel", code] }); qc.invalidateQueries({ queryKey: ["ops-list"] }); };
  const recheck = useMutation({
    mutationFn: async (code: string) => {
      const r = await fetch("/api/recheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Recheck failed");
      return j as { results: { hop: number; verdict: string; error?: string }[]; payout?: string };
    },
    onSuccess: (j, code) => {
      const green = j.results.filter((x) => x.verdict === "green").length;
      const still = j.results.filter((x) => x.verdict === "unchecked").length;
      if (j.payout) toast.success(`${code}: 0G checked it, drivers paid`);
      else if (still) toast.error(`${code}: 0G still not answering (${still} hop${still > 1 ? "s" : ""} waiting)`);
      else toast.success(`${code}: ${green} hop(s) checked by 0G`);
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const [confirming, setConfirming] = useState<string | null>(null);
  // A claim names the stop that was responsible and the parcel's declared value, so the pool can top up the refund.
  const [claim, setClaim] = useState<Record<string, { hop: string; value: string }>>({});
  const resolve = useMutation({
    mutationFn: async ({ code, action }: { code: string; action: "pay" | "refund" }) => {
      const c = claim[code];
      const extra = action === "refund" && c ? { hop: c.hop ? Number(c.hop) : undefined, valueRupees: c.value ? Number(c.value) : undefined } : {};
      const r = await fetch("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, action, reviewer: "operator", ...extra }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not resolve");
      return j;
    },
    onSuccess: (_j, v) => { setConfirming(null); toast.success(v.action === "pay" ? `${v.code}: drivers paid` : `${v.code}: refunded to the shop's balance`); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const approve = useMutation({
    mutationFn: async (code: string) => {
      const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, reviewer: "operator" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not approve");
      return j;
    },
    onSuccess: (_d, code) => { toast.success(`${code}: drivers paid`); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <main className="w-full px-5 py-8 sm:px-8 lg:px-16 xl:px-20">
      <SiteNav />
      <Link href="/ops" className="mb-8 inline-flex text-sm font-semibold text-soft-ink hover:text-ink">← All parcels</Link>
      {isLoading && <p className="text-muted-ink">Reading {code} from Arkiv and the Hedera log...</p>}
      {isError && <p className="text-held">No parcel {code}, or the operator sign-in has expired.</p>}
      <div>
        {data && [data.parcel].map((r) => {
          const s = status(r);
          const byHop = new Map([...r.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h]));
          const split = !r.schedule;
          const anyHeld = [...byHop.values()].some((h) => h.verdict === "held");
          // Split payout: approve as hops come in (each pays its driver's advance). Older bookings: approve at the end.
          const reviewable = !r.paidAt && !anyHeld && (split ? [...byHop.values()].some((h) => h.verdict === "unchecked") : byHop.size === r.route.length);
          const claimOpen = Boolean(r.holdback && !r.holdback.executedAt && !r.holdback.deleted);
          const totalKm = r.route.reduce((a, l) => a + (l.km ?? 0), 0);
          return (
            <section key={r.code}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <h1 className="font-mono text-4xl font-medium tracking-tight sm:text-5xl">{r.code}</h1>
                  <p className="mt-2 truncate text-lg text-soft-ink">{r.label}</p>
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className={`font-display text-2xl font-semibold ${s.tone}`}>{s.text}</span>
                  <span className="font-mono text-sm text-muted-ink">₹{r.feeRupees.toFixed(2)} · {totalKm} km · meter {r.meter} · {when(r.createdAt)}</span>
                </div>
              </div>

              <div className="mt-10">
                <RouteSteps stops={r.route.map((l) => {
                  const h = byHop.get(l.hop);
                  const firstOpen = r.route.find((x) => !byHop.has(x.hop))?.hop;
                  const state: StopState = h ? (r.paidAt && h.verdict === "unchecked" ? "green" : (h.verdict as StopState)) : l.hop === firstOpen ? "next" : "later";
                  const note = h ? when(h.at) : isLate(l.etaAt, false) ? `Running late, expected ${clock(l.etaAt!)}` : l.etaAt ? `Expected ${clock(l.etaAt)}` : undefined;
                  return { hop: l.hop, place: l.place, km: l.km, state, note };
                })} />
              </div>

              <div className="mt-10 grid grid-cols-1 gap-x-10 border-t border-rule md:grid-cols-2 xl:grid-cols-3">
                {r.route.map((l) => {
                  const h = byHop.get(l.hop);
                  const m = r.money.find((x) => x.hop === l.hop);
                  const share = totalKm ? Math.round((r.feeRupees * (l.km ?? 0) / totalKm) * 100) / 100 : 0;
                  return (
                    <article key={l.hop} className="flex flex-col gap-3 border-b border-rule py-6 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-display text-xl font-semibold">Stop {l.hop}, {l.place.split(",")[0]}</p>
                        {(l.km ?? 0) > 0 && <p className="font-mono text-soft-ink">₹{share}</p>}
                      </div>
                      {m && m.advanceRupees > 0 && <PayBar now={m.advanceRupees} held={m.heldRupees ?? 0} label={`${m.advancePct}% at handover`} />}
                      {(l.km ?? 0) > 0 && <p className={m?.answer === "accept" ? "text-ok" : m?.answer === "decline" ? "text-held" : "text-muted-ink"}>{m?.answer === "accept" ? "Driver accepted the job" : m?.answer === "decline" ? "Driver declined the job" : "Waiting for the driver to accept"}</p>}
                      {h?.reason && <p className="text-soft-ink">{h.reason}</p>}
                      {h && (
                        <span className="flex flex-wrap items-center gap-2">
                          {(h as HandoffView & { hasPhoto?: boolean }).hasPhoto && <ProofButton href={`/api/photo/${r.code}/${h.hop}`}>Lid photo</ProofButton>}
                          {h.geo && <ProofButton href={`https://maps.google.com/?q=${h.geo.split(",").slice(0, 2).join(",")}`}>Map</ProofButton>}
                          {h.hcs && <ProofButton href={hashscanTopic(h.hcs)}>Hedera log</ProofButton>}
                          <ProofButton href={arkivEntity(h.key)}>Arkiv record</ProofButton>
                          {h.zgRequestId && <span className="font-mono text-xs text-muted-ink" title={h.zgRequestId}>0G {h.zgRequestId.replace(/^chatcmpl-/, "").slice(0, 8)}</span>}
                        </span>
                      )}
                      {!h && <p className="text-muted-ink">Not handed over yet{l.departsAt ? `, bus leaves ${clock(l.departsAt)}` : ""}</p>}
                    </article>
                  );
                })}
              </div>

              {(r.paidAt || r.money.some((m) => m.advanceRupees > 0)) && (
                <div className="mt-10 text-sm">
                  <p className="font-display text-2xl font-semibold">Where the money went</p>
                  {r.money.filter((m) => (r.route.find((l) => l.hop === m.hop)?.km ?? 0) > 0).map((m) => {
                    const leg = r.route.find((l) => l.hop === m.hop);
                    return (
                      <p key={m.hop} className="mt-1">
                        Stop {m.hop} driver ({leg?.km ?? "?"} km):
                        {m.advanceRupees > 0 && <span> ₹{m.advanceRupees.toFixed(2)} at handover ({m.advancePct}%), ₹{(m.heldRupees ?? 0).toFixed(2)} held until delivery;</span>}
                        {" "}₹{m.upiRupees.toFixed(2)} to UPI so far
                        <span className="text-muted-ink"> ({m.upiStatus === "not_connected" ? "redeemed on chain, UPI partner not connected" : m.upiStatus ?? "pending"}{m.utr ? `, UTR ${m.utr}` : ""})</span>
                        {m.bachatRupees > 0 && <span className="text-ok">, ₹{m.bachatRupees.toFixed(2)} to Bachat</span>}
                      </p>
                    );
                  })}
                  {r.holdback && (
                    <p className="mt-1">
                      Holdbacks ₹{r.holdback.rupees.toFixed(2)}:{" "}
                      {r.holdback.deleted ? "cancelled by a claim; the liable stop's share repaid the shop" : r.holdback.executedAt ? `released on chain ${when(r.holdback.executedAt)}` : `a Hedera scheduled transfer that releases itself ${when(r.holdback.releasesAt ?? 0)}, unless a claim stops it`}
                    </p>
                  )}
                  <p className="mt-1 text-muted-ink">Daak&apos;s 2% was taken by the dINR token&apos;s own fee rule on the way.</p>
                  {r.money.some((m) => m.upiStatus === "not_connected") && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">Pay the drivers by UPI</summary>
                      <UpiPay code={r.code} />
                    </details>
                  )}
                </div>
              )}

              <div className="mt-10 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <ProofButton href={`/track/${r.code}`}>Open customer tracking</ProofButton>
                  {r.schedule && <ProofButton href={`https://hashscan.io/testnet/schedule/${r.schedule}`}>Open scheduled payout</ProofButton>}
                  {r.holdback && <ProofButton href={`https://hashscan.io/testnet/schedule/${r.holdback.schedule}`}>Open holdback schedule</ProofButton>}
                </div>
                {!r.paidAt && [...byHop.values()].some((h) => h.verdict === "unchecked") && (
                  <Button variant="outline" className="rounded-lg border-ink shadow-[var(--shadow-key)] active:translate-y-px" disabled={recheck.isPending} onClick={() => recheck.mutate(r.code)}>
                    {recheck.isPending && recheck.variables === r.code ? "Asking 0G..." : "Recheck with 0G"}
                  </Button>
                )}
                {!r.paidAt && [...byHop.values()].some((h) => h.verdict === "held") && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {confirming === `${r.code}:pay` ? (
                      <Button className="rounded-lg bg-ok text-paper shadow-[var(--shadow-key)] active:translate-y-px" disabled={resolve.isPending} onClick={() => resolve.mutate({ code: r.code, action: "pay" })}>Confirm: pay the drivers</Button>
                    ) : (
                      <Button className="rounded-lg bg-ink text-paper shadow-[var(--shadow-key)] active:translate-y-px" onClick={() => setConfirming(`${r.code}:pay`)}>Pay the drivers anyway</Button>
                    )}
                    {confirming === `${r.code}:refund` ? (
                      (
                      <span className="flex flex-wrap items-center gap-2">
                        <select aria-label="Responsible stop" className="rounded-lg border border-rule bg-paper px-2 py-2 text-sm" value={claim[r.code]?.hop ?? ""} onChange={(e) => setClaim((x) => ({ ...x, [r.code]: { hop: e.target.value, value: x[r.code]?.value ?? "" } }))}>
                          <option value="">Responsible stop: automatic</option>
                          {r.route.filter((l) => (l.km ?? 0) > 0).map((l) => <option key={l.hop} value={l.hop}>Stop {l.hop}: {l.place.split(",")[0]}</option>)}
                        </select>
                        <input aria-label="Declared value in rupees" inputMode="decimal" placeholder="Declared value ₹" className="w-36 rounded-lg border border-rule bg-paper px-3 py-2 text-sm" value={claim[r.code]?.value ?? ""} onChange={(e) => setClaim((x) => ({ ...x, [r.code]: { hop: x[r.code]?.hop ?? "", value: e.target.value } }))} />
                        <Button className="rounded-lg bg-held text-paper shadow-[var(--shadow-key)] active:translate-y-px" disabled={resolve.isPending} onClick={() => resolve.mutate({ code: r.code, action: "refund" })}>Confirm: refund the shop</Button>
                      </span>
                    )
                    ) : (
                      <Button variant="outline" className="rounded-lg border-held text-held shadow-[var(--shadow-key)] active:translate-y-px" onClick={() => setConfirming(`${r.code}:refund`)}>Refund the shop</Button>
                    )}
                  </div>
                )}
                {reviewable && (
                  <Button className="rounded-lg bg-ink text-paper shadow-[var(--shadow-key)] active:translate-y-px" disabled={approve.isPending} onClick={() => approve.mutate(r.code)}>
                    {approve.isPending && approve.variables === r.code ? "Paying..." : split ? "Approve and pay handed-over stops" : "Approve and pay drivers"}
                  </Button>
                )}
                {claimOpen && (
                  confirming === `${r.code}:claim` ? (
                    (
                      <span className="flex flex-wrap items-center gap-2">
                        <select aria-label="Responsible stop" className="rounded-lg border border-rule bg-paper px-2 py-2 text-sm" value={claim[r.code]?.hop ?? ""} onChange={(e) => setClaim((x) => ({ ...x, [r.code]: { hop: e.target.value, value: x[r.code]?.value ?? "" } }))}>
                          <option value="">Responsible stop: automatic</option>
                          {r.route.filter((l) => (l.km ?? 0) > 0).map((l) => <option key={l.hop} value={l.hop}>Stop {l.hop}: {l.place.split(",")[0]}</option>)}
                        </select>
                        <input aria-label="Declared value in rupees" inputMode="decimal" placeholder="Declared value ₹" className="w-36 rounded-lg border border-rule bg-paper px-3 py-2 text-sm" value={claim[r.code]?.value ?? ""} onChange={(e) => setClaim((x) => ({ ...x, [r.code]: { hop: x[r.code]?.hop ?? "", value: e.target.value } }))} />
                        <Button className="rounded-lg bg-held text-paper shadow-[var(--shadow-key)] active:translate-y-px" disabled={resolve.isPending} onClick={() => resolve.mutate({ code: r.code, action: "refund" })}>Confirm: refund the shop</Button>
                      </span>
                    )
                  ) : (
                    <Button variant="outline" className="rounded-lg border-held text-held shadow-[var(--shadow-key)] active:translate-y-px" onClick={() => setConfirming(`${r.code}:claim`)}>Shop reports damage</Button>
                  )
                )}
              </div>
            </section>
          );
        })}
      </div>

      {data?.chain.topicId && (
        <footer className="mt-10 flex flex-wrap gap-2">
          <ProofButton href={`https://hashscan.io/testnet/topic/${data.chain.topicId}`}>Open the public handoff log</ProofButton>
          {data.chain.feeTokenId && <ProofButton href={`https://hashscan.io/testnet/token/${data.chain.feeTokenId}`}>Open the rupee credit token</ProofButton>}
          {data.chain.escrowId && <ProofButton href={`https://hashscan.io/testnet/account/${data.chain.escrowId}`}>Open escrow</ProofButton>}
        </footer>
      )}
      <AssistantChat />
    </main>
  );
}
