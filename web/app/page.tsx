"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { JourneyHero } from "@/components/landing/journey-hero";

type Stats = { topicId?: string; bookings: number; handoffs: number; km: number; paidOut: number; people: number; last: number | null };

const hashscan = (kind: string, id: string) => `https://hashscan.io/testnet/${kind}/${id}`;
/** "0.0.1@123.456" is how the SDK writes a transaction id; HashScan wants "0.0.1-123-456". */
const txUrl = (id: string) => hashscan("transaction", id.replace("@", "-").replace(/\.(\d+)$/, "-$1"));

/** One parcel's day, told as chapters. Each names the part of the stack that does it and links the real proof. */
const CHAPTERS: {
  place: string; title: string; story: string; stack: { name: string; does: string }[];
  proof?: { label: string; value: string; href?: string }[]; shot?: { src: string; alt: string; w: number; h: number };
}[] = [
  {
    place: "Kanpur, 7:04 am",
    title: "The shop books, and its agent pays",
    story: "Gupta Garments taps a new parcel, picks Ghosh Cloth House in Gorakhpur and the best-rated driver for each stretch. The price is the published meter: ₹5 plus 50 paise a road kilometre. The shop's own agent pays it from prepaid rupees; nobody approves a payment.",
    stack: [
      { name: "Hedera x402", does: "The booking API answers 402 with the exact price; the agent pays and retries." },
      { name: "dINR on Hedera Token Service", does: "Rupee credits with Daak's 2% written into the token's own fee rule." },
      { name: "HCS-14 agent identity", does: "The agent checks Daak's ID before paying and leaves its own on the log." },
    ],
    proof: [
      { label: "Paid", value: "₹184.50 meter + ₹22.14 booking fee" },
      { label: "Shop's agent", value: "0.0.11331484", href: hashscan("account", "0.0.11331484") },
      { label: "Booking on the public log", value: "topic 0.0.11327109", href: hashscan("topic", "0.0.11327109") },
    ],
  },
  {
    place: "On Ramesh's phone",
    title: "The driver sees the job, the pay and the bus",
    story: "Ramesh drives the 9:00 bus from Kanpur to Lucknow. The job arrives with the stretch, the kilometres and what he earns at the handover. Every parcel he carries is in one list, active ones first.",
    stack: [
      { name: "Arkiv", does: "People, bookings, timetables and handoffs live as records Daak's app reads; handoffs expire after a day." },
    ],
    shot: { src: "/shots/jobs.webp", alt: "The Daak app's Jobs tab: hand over a parcel, the not driving today switch, and My parcels with Active 13, Delivered 3 and All 16", w: 520, h: 617 },
  },
  {
    place: "Kanpur bus stand",
    title: "A handoff anyone can verify",
    story: "Three taps: the parcel's sticker, the next person's badge, then a photo of the lid with the code on it. The phone signs the handoff with a key in its secure hardware and adds where it happened. The photo is encrypted before it leaves.",
    stack: [
      { name: "Android Keystore", does: "A P-256 key per phone signs every handoff, so nobody records one in a driver's name." },
      { name: "Swarm", does: "The lid photo, encrypted; its reference is sealed again before it goes into the record." },
    ],
    shot: { src: "/shots/handover.webp", alt: "The Daak app's Hand over screen: tap the parcel, tap the other person's badge, photo of the lid", w: 520, h: 535 },
  },
  {
    place: "Inside a sealed machine",
    title: "A sealed AI checks the photo",
    story: "The photo goes to a vision model running inside a TEE on 0G: is this the right code, at the right stop, still sealed? When 0G could not answer this morning, nothing was faked. A backup model refused a photo with the wrong code, the money waited, and 0G's recheck at 11:28 passed all three stops.",
    stack: [
      { name: "0G compute", does: "0gm-1.0-35b-a3b on Intel TDX, in private mode: no unsealed provider can answer." },
      { name: "Safe-stop", does: "No answer in 20 seconds means recorded, not checked, and no payment." },
    ],
    proof: [
      { label: "Kanpur", value: "0G check 6eb1ede1, code matches, parcel intact" },
      { label: "Lucknow", value: "0G check 73f8e8bb" },
      { label: "Gorakhpur", value: "0G check 224ee09e" },
    ],
  },
  {
    place: "Lucknow, 87 km",
    title: "Paid at the handover, not days later",
    story: "The moment Suresh confirms he has the parcel, Ramesh is paid half his stretch: ₹22.35 of ₹44.71. The other half waits for delivery, so if the parcel arrives torn his held pay repays the shop. Proven handoffs raise his share to 70% and then 90%.",
    stack: [
      { name: "Hedera Token Service", does: "Escrow pays each advance as a token transfer; drivers redeem it to UPI." },
    ],
    proof: [
      { label: "Ramesh, Kanpur to Lucknow", value: "₹22.35 now, ₹22.36 held", href: txUrl("0.0.11325722@1793944725.308873159") },
      { label: "Suresh, Lucknow to Gorakhpur", value: "₹69.89 now, ₹69.90 held", href: txUrl("0.0.11325722@1793944729.696671174") },
    ],
    shot: { src: "/shots/parcel.webp", alt: "KNP-1204 in the Daak app: three stops checked and handed over, the pay at each handover, and the held pay released on Hedera", w: 520, h: 864 },
  },
  {
    place: "Gorakhpur, 11:44 am",
    title: "Delivered, and the rest of the pay releases itself",
    story: "At delivery Daak signs one scheduled transfer of everything still held, ₹92.26, set to run when the claim window ends. If the shop reports damage, the schedule is deleted and the responsible stop's share goes back to the shop. Nobody did either: at 11:44:00 Hedera ran it on its own.",
    stack: [
      { name: "Hedera scheduled transactions", does: "Long-term schedules with wait-for-expiry: escrow with a dispute window and no server." },
      { name: "Hedera Consensus Service", does: "Every booking, handoff, check and payout as a public message." },
    ],
    proof: [
      { label: "Held pay schedule", value: "0.0.11335076, executed 11:44:00", href: hashscan("schedule", "0.0.11335076") },
      { label: "The whole parcel, read-only", value: "/live/KNP-1204", href: "/live/KNP-1204" },
    ],
  },
];

const PAINS = [
  ["Nobody signs at the stand", "A parcel changes hands between two buses with no receipt, so a lost one has no last owner."],
  ["Every driver quotes his own rate", "The same stretch costs a different amount every time, and the shop cannot check it."],
  ["Pay leaves no record", "Cash, days late, written nowhere: no savings, no loan, no proof of years of work."],
  ["Damage belongs to no one", "When a parcel arrives torn, each person blames the next and the shop pays."],
];

function Proof({ items }: { items: NonNullable<(typeof CHAPTERS)[number]["proof"]> }) {
  return (
    <dl className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-card-paper">
      {items.map((p) => (
        <div key={p.label} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="text-sm text-muted-ink">{p.label}</dt>
          <dd className="font-medium tabular-nums">
            {p.href ? <a href={p.href} target={p.href.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="underline decoration-rule decoration-2 underline-offset-4 transition-colors hover:decoration-wait">{p.value}</a> : p.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The public face of Daak: one real parcel's journey, chapter by chapter, with the part of the stack behind each step. */
export default function Landing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { data: s } = useQuery<Stats>({ queryKey: ["stats"], queryFn: () => fetch("/api/stats").then((r) => r.json()), refetchInterval: 30000 });
  const track = (e: React.FormEvent) => { e.preventDefault(); if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`); };

  return (
    <main className="w-full">
      {/* Night on the Grand Trunk Road: the one moment that moves on its own. */}
      <section className="bg-night px-4 pb-12 pt-8 text-paper sm:px-6 lg:px-10 lg:pb-16">
        <SiteNav dark className="mb-12 lg:mb-16" />
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-12 xl:items-center">
          <div className="xl:col-span-5">
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl xl:text-7xl">Every parcel handoff, on the record.</h1>
            <p lang="hi" className="mt-4 font-display text-2xl font-semibold text-lamp sm:text-3xl">हर पार्सल का हिसाब, हर ड्राइवर को किलोमीटर से भुगतान।</p>
            <p className="mt-5 max-w-xl text-lg text-paper/75">
              Parcels in UP and Bihar ride two buses and pass through three pairs of hands. Daak gives each handoff a signature, a photo and a sealed check, and pays every driver by the kilometre at the moment they hand over.
            </p>
            <form onSubmit={track} className="mt-7 flex w-full max-w-md gap-2">
              <label htmlFor="code" className="sr-only">Parcel code</label>
              <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Track a parcel: KNP-1204"
                className="min-w-0 flex-1 rounded-xl border border-paper/20 bg-paper/5 px-4 py-3 text-base text-paper placeholder:text-paper/45 outline-none focus-visible:ring-2 focus-visible:ring-lamp" />
              <button type="submit" className="rounded-xl bg-lamp px-5 py-3 font-semibold text-night shadow-lg shadow-black/20 transition-transform active:scale-[0.97]">Track</button>
            </form>
            <Link href="/live" className="mt-3 inline-block text-sm font-medium text-paper/75 underline decoration-paper/25 underline-offset-4 hover:text-paper">Or watch every delivery live</Link>
          </div>
          <div className="xl:col-span-7">
            <JourneyHero />
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-10">
        <section aria-label="Live from the public log" className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-rule py-10 lg:grid-cols-4">
          {[
            [s?.handoffs ?? "–", "handoffs on the record"],
            [s ? `${s.km} km` : "–", "carried and proven"],
            [s ? `₹${Math.round(s.paidOut)}` : "–", "redeemed for drivers"],
            [s?.bookings ?? "–", "bookings paid by agents"],
          ].map(([n, label]) => (
            <div key={String(label)}>
              <p className="font-display text-5xl font-extrabold tabular-nums leading-none sm:text-6xl">{n}</p>
              <p className="mt-2 text-muted-ink">{label}</p>
            </div>
          ))}
          <p className="col-span-2 text-sm text-muted-ink lg:col-span-4">
            Counted live from Daak&apos;s public Hedera log on testnet.{" "}
            {s?.topicId && <a className="font-medium text-ink underline decoration-rule decoration-2 underline-offset-4" href={hashscan("topic", s.topicId)} target="_blank" rel="noreferrer">Read the log yourself</a>}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-8 py-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight">The buses already carry the parcels. Nothing else does.</h2>
            <p className="mt-3 max-w-md text-muted-ink">India Post and the state buses built the network decades ago. What is missing is a receipt at each stand and a fair meter.</p>
          </div>
          <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:col-span-8">
            {PAINS.map(([t, d]) => (
              <li key={t} className="border-t border-rule py-5">
                <p className="font-display text-xl font-bold">{t}</p>
                <p className="mt-1 text-muted-ink">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="journey" className="pb-8">
          <h2 id="journey" className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">One parcel, KNP-1204, start to finish</h2>
          <p className="mt-3 max-w-2xl text-lg text-muted-ink">A box of garments from Kanpur to Gorakhpur on 6 November, 359 km on two buses. Every number below is from its public record.</p>

          {/* The road runs down the page: each chapter is a stand on it. */}
          <ol className="relative mt-12 flex flex-col gap-16 border-l-4 border-dashed border-wait/40 pl-6 sm:pl-10 lg:ml-4">
            {CHAPTERS.map((c, i) => (
              <li key={c.title} className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
                <span aria-hidden className="absolute -left-[calc(1.5rem+14px)] top-1 grid size-6 place-items-center rounded-md bg-wait font-display text-sm font-extrabold text-paper sm:-left-[calc(2.5rem+14px)]">{i + 1}</span>
                <div className={c.shot ? "lg:col-span-7" : "lg:col-span-6"}>
                  <p className="text-sm font-medium text-wait">{c.place}</p>
                  <h3 className="mt-1 font-display text-3xl font-extrabold leading-tight tracking-tight">{c.title}</h3>
                  <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink/85">{c.story}</p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {c.stack.map((x) => (
                      <li key={x.name} className="flex flex-col gap-0.5 rounded-xl bg-rule/35 px-4 py-3 sm:flex-row sm:gap-4">
                        <span className="shrink-0 font-semibold sm:w-56">{x.name}</span>
                        <span className="text-muted-ink">{x.does}</span>
                      </li>
                    ))}
                  </ul>
                  {c.proof && c.shot && <div className="mt-6"><Proof items={c.proof} /></div>}
                </div>
                <div className={c.shot ? "lg:col-span-5" : "lg:col-span-6 lg:pt-8"}>
                  {c.shot ? (
                    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-[2rem] border-[10px] border-night bg-paper shadow-xl shadow-night/20">
                      <Image src={c.shot.src} alt={c.shot.alt} width={c.shot.w} height={c.shot.h} className="h-auto w-full" />
                    </div>
                  ) : c.proof && <Proof items={c.proof} />}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-1 gap-6 border-t border-rule py-16 md:grid-cols-3">
          {[
            ["Drivers", "Paid by the kilometre at every handover, a savings pot, and a record of proven work they own: it raises their share up front and unlocks fuel advances."],
            ["Shops", "One published rate, the route and drivers chosen before paying, a photo at every stand, and a refund from the responsible driver's held pay."],
            ["Receiving shops", "Tap the parcel with any phone to see where it is. No app and no account."],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-display text-2xl font-extrabold">{t}</p>
              <p className="mt-2 text-muted-ink">{d}</p>
            </div>
          ))}
          <p className="text-muted-ink md:col-span-3">
            Nobody on the route sees a wallet or a token. Phone numbers, UPI IDs and ID documents are sealed before they reach any record; badges appear on the public log only as a short hash.
          </p>
        </section>
      </div>

      <section className="bg-night px-4 py-14 text-paper sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Named after the dak, the relay that carried India&apos;s post by runner and horse.</h2>
            <p className="mt-3 max-w-2xl text-paper/70">Same idea, one change: every hand on the route signs, and every hand gets paid.</p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5">
            <form onSubmit={track} className="flex gap-2">
              <label htmlFor="code2" className="sr-only">Parcel code</label>
              <input id="code2" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Parcel code"
                className="min-w-0 flex-1 rounded-xl border border-paper/20 bg-paper/5 px-4 py-3 text-paper placeholder:text-paper/45 outline-none focus-visible:ring-2 focus-visible:ring-lamp" />
              <button type="submit" className="rounded-xl bg-lamp px-5 py-3 font-semibold text-night transition-transform active:scale-[0.97]">Track</button>
            </form>
            <div className="flex flex-wrap gap-2">
              {[["/live", "Live deliveries"], ["/network", "The network map"], ["/drivers", "Drivers' records"], ["https://github.com/adilhusain01/daak", "Source on GitHub"]].map(([href, label]) => (
                <a key={href} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                  className="rounded-lg bg-paper/10 px-3 py-2 text-sm font-medium transition-transform hover:bg-paper/15 active:scale-[0.97]">{label}</a>
              ))}
            </div>
          </div>
        </div>
        <footer className="mt-12 flex flex-col gap-2 border-t border-paper/15 pt-6 text-sm text-paper/55 sm:flex-row sm:justify-between">
          <span>Built at ETHGlobal Mumbai 2026. Testnet build, MIT licence.</span>
          <span>Post office data: India Post (GODL-India). Map data: OpenStreetMap. Roads: OSRM.</span>
        </footer>
      </section>
    </main>
  );
}
