"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";

type Stats = { topicId?: string; tokenId?: string; bookings: number; handoffs: number; km: number; paidOut: number; people: number; last: number | null };

const ago = (ms: number) => {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** The pilot corridor, by road. Shares are the meter (Rs 5 + Rs 0.50 a km) split by each stretch's km. */
const STOPS = [
  { name: "Kanpur", note: "The shop books and hands the parcel to Ramesh", leg: null },
  { name: "Lucknow", note: "Ramesh hands it to Suresh", leg: "87 km · ₹44.71 to Ramesh" },
  { name: "Gorakhpur", note: "Suresh hands it to the receiving shop", leg: "272 km · ₹139.79 to Suresh" },
];

const PAINS = [
  ["Nobody signs", "Parcels change hands at the bus stand with no receipt, so a lost parcel has no last owner."],
  ["Every rate is different", "Each driver quotes his own price for the same stretch, so a shop never knows the fair fee."],
  ["Pay leaves no record", "Drivers are paid in cash, days late, with nothing written down, so no loan and no savings."],
  ["Damage has no owner", "When a parcel arrives torn, everyone blames the next person and the shop pays."],
];

const STEPS = [
  ["Book", "The shop taps a new parcel, picks the receiver and the best-rated driver for each stretch, and its agent pays the meter."],
  ["Hand over", "At each stand: tap the parcel, tap the other person's badge, photograph the lid. The phone adds where it happened and signs it."],
  ["Check", "A sealed AI checks the photo: right parcel, right stop, still sealed. If it cannot answer, the payment waits. Nothing is faked."],
  ["Pay", "Each driver gets part of their pay the moment the next person confirms the handover, and the rest once the parcel is delivered, straight to UPI."],
];

const PEOPLE = [
  ["Drivers", "Pay by the kilometre at every handover, a Bachat savings pot, and a proven record that unlocks fuel advances, more of their pay up front and more bookings."],
  ["Shops", "One published rate per km, the route and drivers chosen before paying, a photo at every handoff, and a refund from the liable driver's held pay if something breaks."],
  ["Receiving shops", "Tap the parcel with any phone to see where it is and what comes next. No app, no account."],
];

const STACK = [
  ["Hedera", "Bookings paid over x402, a rupee-credit token with Daak's 2% built in, escrow, pay held in scheduled transfers that release themselves, and the public handoff log."],
  ["0G", "The sealed vision check at every stop and the log of every decision."],
  ["Arkiv", "Every person, booking and handoff as records that expire when they are no longer needed."],
  ["Swarm", "Lid photos and ID photos, encrypted."],
];

/** One section: the heading and its point on the left, the detail on the right; stacked on a phone. */
function Section({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-6 border-t border-rule pt-10 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-4">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {lede && <p className="mt-2 max-w-md text-muted-ink">{lede}</p>}
      </div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

const Card = ({ title, children, kicker }: { title: string; children: React.ReactNode; kicker?: string }) => (
  <div className="rounded-xl border border-rule bg-card-paper p-5">
    {kicker && <p className="text-sm text-muted-ink">{kicker}</p>}
    <p className="text-lg font-semibold">{title}</p>
    <p className="mt-1 text-muted-ink">{children}</p>
  </div>
);

/** The public face of Daak: what it is, live proof from the chain, and a box to track a parcel. */
export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { data: s } = useQuery<Stats>({ queryKey: ["stats"], queryFn: () => fetch("/api/stats").then((r) => r.json()), refetchInterval: 30000 });

  return (
    <main className="w-full px-4 pb-16 pt-8 sm:px-6 lg:px-10">
      <SiteNav className="mb-12 lg:mb-16" />

      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
        <section className="flex flex-col gap-5 lg:col-span-7">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">Every parcel handoff proven. Every driver paid by the kilometre.</h1>
          <p className="max-w-2xl text-lg text-muted-ink">For goods that ride two buses and three pairs of hands, from a Kanpur shop to a Gorakhpur store. Named after the dak relay of the Grand Trunk Road.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`); }} className="flex w-full max-w-md gap-2">
            <label htmlFor="code" className="sr-only">Parcel code</label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Parcel code, like KNP-1981"
              className="min-w-0 flex-1 rounded-xl border border-rule bg-card-paper px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ink" />
            <button type="submit" className="rounded-xl bg-ink px-5 py-3 font-medium text-paper shadow-sm transition-transform active:scale-[0.97]">Track</button>
          </form>
        </section>

        <section aria-label="A delivery on the route" className="rounded-2xl border border-rule bg-card-paper p-5 sm:p-7 lg:col-span-5">
          <p className="text-sm font-medium text-muted-ink">Kanpur to Gorakhpur, 359 km by road</p>
          <ol className="mt-5 flex flex-col">
            {STOPS.map((st, i) => (
              <li key={st.name} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 size-3.5 shrink-0 rounded-[4px] bg-ok" />
                  {i < STOPS.length - 1 && <span className="my-1 w-px flex-1 bg-rule" />}
                </div>
                <div className={i < STOPS.length - 1 ? "pb-5" : ""}>
                  <p className="text-lg font-semibold">{st.name}</p>
                  <p className="text-sm text-muted-ink">{st.note}</p>
                  {st.leg && <p className="mt-1 text-sm font-medium">{st.leg}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-rule pt-4 text-sm text-muted-ink">
            Daak meter: ₹5 + ₹0.50 a km, to the drivers, less Daak&apos;s 2% on each payout. ₹184.50 for the whole route up to 5 kg, plus Daak&apos;s 12% booking fee, ₹22.14.
            Heavier parcels: ×1.5 up to 15 kg, ×2 up to 30 kg, ×3 up to 50 kg.
          </p>
        </section>
      </div>

      <section aria-label="Live from the public log" className="mt-12 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          [s?.handoffs ?? "–", "handoffs recorded"],
          [s ? `${s.km} km` : "–", "carried and proven"],
          [s ? `₹${Math.round(s.paidOut)}` : "–", "redeemed for drivers"],
          [s?.people ?? "–", "people joined"],
        ].map(([n, label]) => (
          <div key={String(label)} className="rounded-xl bg-rule/40 px-5 py-4">
            <p className="text-3xl font-semibold">{n}</p>
            <p className="text-sm text-muted-ink">{label}</p>
          </div>
        ))}
        <p className="col-span-2 text-sm text-muted-ink lg:col-span-4">
          Counted live from Daak&apos;s public Hedera log{s?.last ? `, last entry ${ago(s.last)}` : ""}.{" "}
          {s?.topicId && <a className="font-medium text-ink underline underline-offset-2" href={`https://hashscan.io/testnet/topic/${s.topicId}`} target="_blank" rel="noreferrer">Open the log</a>}
        </p>
      </section>

      <div className="mt-16 flex flex-col gap-14">
        <Section title="What breaks today" lede="Buses across UP and Bihar already carry parcels between towns, with nothing written down along the way.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PAINS.map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}
          </div>
        </Section>

        <Section title="How a delivery works" lede="Four steps, the same at every stand. Drivers and shops never see a wallet or a token.">
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STEPS.map(([t, d], i) => <li key={t}><Card title={t} kicker={`Step ${i + 1}`}>{d}</Card></li>)}
          </ol>
        </Section>

        <Section title="Who gains" lede="Everyone on the route gets something they do not have today.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PEOPLE.map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}
          </div>
        </Section>

        <Section title="Private by design" lede="Anyone can check the record without learning who the people on it are.">
          <p className="max-w-3xl text-muted-ink">
            Phone numbers, UPI IDs and driver IDs are sealed before they reach the public record. Badges appear on the public log only as a short hash. Lid photos and ID photos are stored encrypted, and only Daak&apos;s operators can open them. Only the last 4 characters of an ID are kept.
          </p>
        </Section>

        <Section title="Built on" lede="Each part of the record sits where it is cheapest to keep and hardest to change.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STACK.map(([t, d]) => <Card key={t} title={t}>{d}</Card>)}
          </div>
        </Section>
      </div>

      <footer className="mt-16 flex flex-col gap-2 border-t border-rule pt-6 text-sm text-muted-ink sm:flex-row sm:justify-between">
        <span>Built at ETHGlobal Mumbai 2026 · testnet build</span>
        <span>Post office data: India Post (GODL-India) · Map data: OpenStreetMap</span>
      </footer>
    </main>
  );
}
