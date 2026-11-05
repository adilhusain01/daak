"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Stats = { topicId?: string; tokenId?: string; bookings: number; handoffs: number; km: number; paidOut: number; people: number; last: number | null };

const ago = (ms: number) => {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

const STOPS = [
  { name: "Kanpur", note: "Shop books, hands to Ramesh" },
  { name: "Lucknow", note: "Ramesh hands to Suresh" },
  { name: "Gorakhpur", note: "Suresh hands to the shop" },
];

/** The public face of Daak: what it is, live proof from the chain, and a box to track a parcel. */
export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { data: s } = useQuery<Stats>({ queryKey: ["stats"], queryFn: () => fetch("/api/stats").then((r) => r.json()), refetchInterval: 30000 });

  return (
    <main className="w-full px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <nav className="mb-14 flex items-center justify-between gap-3">
        <span className="text-2xl font-semibold tracking-tight">Daak</span>
        <div className="flex gap-2">
          <Link href="/network" className="rounded-lg bg-card-paper px-3 py-1.5 text-sm font-medium shadow-sm transition-transform active:scale-[0.97]">Network</Link>
          <Link href="/drivers" className="rounded-lg bg-card-paper px-3 py-1.5 text-sm font-medium shadow-sm transition-transform active:scale-[0.97]">Drivers</Link>
          <Link href="/ops" className="rounded-lg bg-card-paper px-3 py-1.5 text-sm font-medium shadow-sm transition-transform active:scale-[0.97]">Operations</Link>
        </div>
      </nav>

      <section className="flex flex-col gap-5">
        <h1 className="max-w-5xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Every parcel handoff proven. Every driver paid by the kilometre.</h1>
        <p className="max-w-2xl text-lg text-muted-ink">For goods that ride two buses and three pairs of hands, from a Kanpur shop to a Gorakhpur store. Named after the dak relay of the Grand Trunk Road.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`); }} className="flex w-full max-w-md gap-2">
          <label htmlFor="code" className="sr-only">Parcel code</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Parcel code, like KNP-1981"
            className="min-w-0 flex-1 rounded-xl border border-rule bg-card-paper px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ink" />
          <button type="submit" className="rounded-xl bg-ink px-5 py-3 font-medium text-paper shadow-sm transition-transform active:scale-[0.97]">Track</button>
        </form>
      </section>

      <section aria-label="A delivery on the route" className="mt-12 rounded-2xl border border-rule bg-card-paper p-5 sm:p-8">
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STOPS.map((st, i) => (
            <li key={st.name} className="relative flex gap-3 sm:flex-col">
              <span className="mt-1 size-3.5 shrink-0 rounded-[4px] bg-ok" />
              <div>
                <p className="text-lg font-semibold">{st.name}</p>
                <p className="text-sm text-muted-ink">{st.note}</p>
                {i > 0 && <p className="mt-1 text-sm">{i === 1 ? "80 km · ₹41" : "270 km · ₹139"}</p>}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted-ink">Daak meter: ₹5 + ₹0.50 a km, all of it to the drivers, split by the kilometres each one carried. Kanpur to Gorakhpur, 350 km: ₹180 to the drivers plus Daak's 12% booking fee, ₹21.60.</p>
      </section>

      <section aria-label="Live from the public log" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [s?.handoffs ?? "–", "handoffs recorded"],
          [s ? `${s.km} km` : "–", "carried and proven"],
          [s ? `₹${Math.round(s.paidOut)}` : "–", "paid to drivers"],
          [s?.people ?? "–", "people joined"],
        ].map(([n, label]) => (
          <div key={String(label)} className="rounded-xl bg-rule/40 px-4 py-3">
            <p className="text-2xl font-semibold">{n}</p>
            <p className="text-sm text-muted-ink">{label}</p>
          </div>
        ))}
        <p className="col-span-2 text-sm text-muted-ink sm:col-span-4">
          Counted live from Daak&apos;s public Hedera log{s?.last ? `, last entry ${ago(s.last)}` : ""}.{" "}
          {s?.topicId && <a className="font-medium text-ink underline underline-offset-2" href={`https://hashscan.io/testnet/topic/${s.topicId}`} target="_blank" rel="noreferrer">Open the log</a>}
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">What breaks today</h2>
        <p className="mt-2 max-w-2xl text-muted-ink">Nobody signs at the bus stand. Every driver quotes a different rate. Pay is cash, days late, with no record of the work, so no loan and no savings. When a parcel arrives torn, everyone blames the next person.</p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">How a delivery works</h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["Book", "The shop taps a new parcel, picks the receiver and the best-rated driver for each stretch, and its agent pays the meter."],
            ["Hand over", "At each stand: tap the parcel, tap the other person's badge, photograph the lid. The phone adds where it happened."],
            ["Check", "A sealed AI checks the photo: right parcel, right stop, still sealed. If it cannot answer, the payment waits. Nothing is faked."],
            ["Pay", "At delivery each driver is paid for their kilometres, straight to UPI. A share can go to their Bachat savings."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-rule bg-card-paper p-5">
              <p className="text-sm text-muted-ink">Step {i + 1}</p>
              <p className="text-lg font-semibold">{t}</p>
              <p className="mt-1 text-muted-ink">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Drivers", "Instant pay by the kilometre, a savings pot, and a proven record that unlocks fuel advances and more bookings."],
          ["Shops", "One published rate per km, the route and drivers chosen before paying, and a photo at every handoff."],
          ["Receiving shops", "Tap the parcel with any phone to see where it is and what comes next."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-rule bg-card-paper p-5">
            <p className="text-lg font-semibold">{t}</p>
            <p className="mt-1 text-muted-ink">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Private by design</h2>
        <p className="mt-2 max-w-2xl text-muted-ink">Phone numbers and UPI IDs are sealed before they reach the public record. Badges appear on the public log only as a short hash. Lid photos are stored encrypted, and only Daak&apos;s operators can open them.</p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Built on</h2>
        <ul className="mt-3 flex flex-col gap-1 text-muted-ink">
          <li><span className="font-medium text-ink">Hedera:</span> bookings paid over x402, a rupee-credit token with Daak&apos;s 2% built in, escrow, payouts as scheduled transactions, and the public handoff log.</li>
          <li><span className="font-medium text-ink">0G:</span> the sealed vision check at every stop and the log of every decision.</li>
          <li><span className="font-medium text-ink">Arkiv:</span> every person, booking and handoff as records that expire when they are no longer needed.</li>
          <li><span className="font-medium text-ink">Swarm:</span> the lid photos, encrypted.</li>
        </ul>
      </section>

      <footer className="mt-16 border-t border-rule pt-6 text-sm text-muted-ink">Built at ETHGlobal Mumbai 2026 · testnet build</footer>
    </main>
  );
}
