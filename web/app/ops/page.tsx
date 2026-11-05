"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteNav, ProofButton } from "@/components/site-nav";
import { UpiPay } from "@/components/upi-pay";
import { KycReview } from "@/components/kyc-review";
import { StandingPanel } from "@/components/standing-panel";
import { ShopsPanel } from "@/components/shops-panel";
import { useState } from "react";
import { arkivEntity, hashscanTopic, verdictText, when, type HandoffView, type LegView } from "@/lib/ui";

type Money = { hop: number; account: string; upiRupees: number; upiStatus: string | null; utr: string | null; bachatRupees: number; advanceRupees: number; advancePct: number | null; heldRupees: number | null; answer: string | null };
type Holdback = { schedule: string; releasesAt: number | null; rupees: number; executedAt: number | null; deleted: boolean };
type Row = {
  code: string; label: string; feeRupees: number; createdAt: number; schedule?: string; paidAt: number | null; km: number; meter: string; money: Money[]; holdback: Holdback | null;
  route: (LegView & { from: string; to: string; advancePct?: number })[]; handoffs: HandoffView[];
};
type Data = { chain: { topicId?: string; feeTokenId?: string; escrowId?: string }; consignments: Row[] };

function status(r: Row) {
  if (r.holdback?.deleted) return { text: "Claim settled, shop refunded", tone: "text-held" };
  if (r.holdback?.executedAt) return { text: "Delivered, drivers paid in full", tone: "text-ok" };
  if (r.holdback) return { text: `Delivered, holdbacks release ${when(r.holdback.releasesAt ?? 0)}`, tone: "text-ok" };
  if (r.paidAt) return { text: "Delivered, drivers paid", tone: "text-ok" };
  if (r.handoffs.some((h) => h.verdict === "held")) return { text: "Payment held", tone: "text-held" };
  const done = new Set(r.handoffs.map((h) => h.hop)).size;
  if (done === r.route.length) return { text: "Delivered, waiting for review", tone: "text-wait" };
  return { text: `In transit, ${done} of ${r.route.length} stops`, tone: "text-ink" };
}

type Filter = "all" | "attention" | "transit" | "paid";

/** A delivery needs the operator when a hop is held, or every hop is in but some were not checked by AI. */
function needsAttention(r: Row) {
  if (r.paidAt) return false;
  const latest = new Map([...r.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h.verdict]));
  if ([...latest.values()].some((v) => v === "held")) return true;
  if (!r.schedule) return [...latest.values()].some((v) => v === "unchecked");
  return latest.size === r.route.length && [...latest.values()].some((v) => v === "unchecked");
}

export default function Dashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Data>({ queryKey: ["consignments"], queryFn: () => fetch("/api/consignments").then((r) => r.json()) });
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
      qc.invalidateQueries({ queryKey: ["consignments"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const [confirming, setConfirming] = useState<string | null>(null);
  const resolve = useMutation({
    mutationFn: async ({ code, action }: { code: string; action: "pay" | "refund" }) => {
      const r = await fetch("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, action, reviewer: "operator" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not resolve");
      return j;
    },
    onSuccess: (_j, v) => { setConfirming(null); toast.success(v.action === "pay" ? `${v.code}: drivers paid` : `${v.code}: payout cancelled, fee back for the shop's refund`); qc.invalidateQueries({ queryKey: ["consignments"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
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
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-muted-ink">Every parcel, every handoff, every rupee owed to the drivers who carried it.</p>
      </header>

      {data && (() => {
        const counts = { all: data.consignments.length, attention: data.consignments.filter(needsAttention).length, transit: data.consignments.filter((r) => !r.paidAt && !needsAttention(r)).length, paid: data.consignments.filter((r) => r.paidAt).length };
        const tab = (id: Filter, label: string, n: number) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`flex flex-col items-start rounded-xl px-4 py-3 text-left transition-transform active:scale-[0.97] ${filter === id ? "bg-rule/70" : "bg-card-paper shadow-sm"}`}>
            <span className="text-2xl font-semibold">{n}</span>
            <span className="text-sm text-muted-ink">{label}</span>
          </button>
        );
        return (
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tab("all", "All deliveries", counts.all)}
            {tab("attention", "Need you", counts.attention)}
            {tab("transit", "On the way", counts.transit)}
            {tab("paid", "Paid out", counts.paid)}
          </div>
        );
      })()}

      <KycReview />
      <StandingPanel />
      <ShopsPanel />
      {isLoading && <p className="text-muted-ink">Loading deliveries...</p>}
      {data && data.consignments.length === 0 && <p className="text-muted-ink">No deliveries booked yet.</p>}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {data?.consignments.filter((r) => filter === "all" || (filter === "attention" ? needsAttention(r) : filter === "paid" ? Boolean(r.paidAt) : !r.paidAt && !needsAttention(r))).map((r) => {
          const s = status(r);
          const byHop = new Map([...r.handoffs].sort((a, b) => a.at - b.at).map((h) => [h.hop, h]));
          const split = !r.schedule;
          const anyHeld = [...byHop.values()].some((h) => h.verdict === "held");
          // Split payout: approve as hops come in (each pays its driver's advance). Older bookings: approve at the end.
          const reviewable = !r.paidAt && !anyHeld && (split ? [...byHop.values()].some((h) => h.verdict === "unchecked") : byHop.size === r.route.length);
          const claimOpen = Boolean(r.holdback && !r.holdback.executedAt && !r.holdback.deleted);
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
                  <span className="text-sm text-muted-ink">Meter {r.meter}: ₹{r.feeRupees.toFixed(2)} for {totalKm} km, booked {when(r.createdAt)}</span>
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
                        <span className="text-sm text-muted-ink">
                          {l.km ?? "?"} km, driver share ₹{share}
                          {(l.km ?? 0) > 0 && l.advancePct != null && `: ${l.advancePct}% at handover, ${100 - l.advancePct}% after delivery`}
                          {(l.km ?? 0) > 0 && (() => { const a = r.money.find((m) => m.hop === l.hop)?.answer; return <span className={a === "accept" ? "text-ok" : a === "decline" ? "text-held" : ""}> · {a === "accept" ? "driver accepted" : a === "decline" ? "driver declined" : "waiting for the driver"}</span>; })()}
                        </span>
                      </div>
                      {h ? (
                        <div className="mt-1 flex flex-col gap-1 text-sm">
                          <span className={r.paidAt && h.verdict !== "held" ? "text-ok" : v?.tone}>{r.paidAt && h.verdict === "unchecked" ? "Approved by a reviewer and paid" : v?.en}, {when(h.at)}</span>
                          {h.reason && <span className="text-muted-ink">{h.reason}</span>}
                          <span className="mt-1 flex flex-wrap gap-2 text-muted-ink">
                            {(h as HandoffView & { hasPhoto?: boolean }).hasPhoto && <ProofButton href={`/api/photo/${r.code}/${h.hop}`}>View lid photo</ProofButton>}
                            {h.geo && <ProofButton href={`https://maps.google.com/?q=${h.geo.split(",").slice(0, 2).join(",")}`}>Open on map</ProofButton>}
                            {h.hcs && <ProofButton href={hashscanTopic(h.hcs)}>Open Hedera log</ProofButton>}
                            <ProofButton href={arkivEntity(h.key)}>Open Arkiv record</ProofButton>
                            {h.zgRequestId && <span className="self-center text-xs">0G receipt {h.zgRequestId.slice(0, 10)}</span>}
                          </span>
                        </div>
                      ) : (
                        <span className="mt-1 block text-sm text-muted-ink">Not handed over yet</span>
                      )}
                    </li>
                  );
                })}
              </ol>

              {(r.paidAt || r.money.some((m) => m.advanceRupees > 0)) && (
                <div className="mt-4 rounded-lg border border-rule p-3 text-sm">
                  <p className="font-medium">Where the money went</p>
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

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <ProofButton href={`/track/${r.code}`}>Open customer tracking</ProofButton>
                  {r.schedule && <ProofButton href={`https://hashscan.io/testnet/schedule/${r.schedule}`}>Open scheduled payout</ProofButton>}
                  {r.holdback && <ProofButton href={`https://hashscan.io/testnet/schedule/${r.holdback.schedule}`}>Open holdback schedule</ProofButton>}
                </div>
                {!r.paidAt && [...byHop.values()].some((h) => h.verdict === "unchecked") && (
                  <Button variant="outline" className="rounded-lg border-ink shadow-sm active:translate-y-px" disabled={recheck.isPending} onClick={() => recheck.mutate(r.code)}>
                    {recheck.isPending && recheck.variables === r.code ? "Asking 0G..." : "Recheck with 0G"}
                  </Button>
                )}
                {!r.paidAt && [...byHop.values()].some((h) => h.verdict === "held") && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {confirming === `${r.code}:pay` ? (
                      <Button className="rounded-lg bg-ok text-paper shadow-sm active:translate-y-px" disabled={resolve.isPending} onClick={() => resolve.mutate({ code: r.code, action: "pay" })}>Confirm: pay the drivers</Button>
                    ) : (
                      <Button className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" onClick={() => setConfirming(`${r.code}:pay`)}>Pay the drivers anyway</Button>
                    )}
                    {confirming === `${r.code}:refund` ? (
                      <Button className="rounded-lg bg-held text-paper shadow-sm active:translate-y-px" disabled={resolve.isPending} onClick={() => resolve.mutate({ code: r.code, action: "refund" })}>Confirm: refund the shop</Button>
                    ) : (
                      <Button variant="outline" className="rounded-lg border-held text-held shadow-sm active:translate-y-px" onClick={() => setConfirming(`${r.code}:refund`)}>Refund the shop</Button>
                    )}
                  </div>
                )}
                {reviewable && (
                  <Button className="rounded-lg bg-ink text-paper shadow-sm active:translate-y-px" disabled={approve.isPending} onClick={() => approve.mutate(r.code)}>
                    {approve.isPending && approve.variables === r.code ? "Paying..." : split ? "Approve and pay handed-over stops" : "Approve and pay drivers"}
                  </Button>
                )}
                {claimOpen && (
                  confirming === `${r.code}:claim` ? (
                    <Button className="rounded-lg bg-held text-paper shadow-sm active:translate-y-px" disabled={resolve.isPending} onClick={() => resolve.mutate({ code: r.code, action: "refund" })}>Confirm: last stop is liable, refund the shop</Button>
                  ) : (
                    <Button variant="outline" className="rounded-lg border-held text-held shadow-sm active:translate-y-px" onClick={() => setConfirming(`${r.code}:claim`)}>Shop reports damage</Button>
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
    </main>
  );
}
