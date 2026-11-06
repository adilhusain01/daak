"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { JourneyCaption, JourneySteps, useJourney } from "@/components/landing/journey-hero";
import { HeroFilm, FILM_ALT } from "@/components/landing/hero-film";
import { MorphStory } from "@/components/landing/morph-story";
import { Architecture } from "@/components/landing/architecture";
import { PhoneFrame } from "@/components/phone-frame";
import { Market } from "@/components/landing/market";


type Stats = { topicId?: string; bookings: number; handoffs: number; km: number; paidOut: number; people: number; last: number | null };

const hashscan = (kind: string, id: string) => `https://hashscan.io/testnet/${kind}/${id}`;
/** "0.0.1@123.456" is how the SDK writes a transaction id; HashScan wants "0.0.1-123-456". */
const txUrl = (id: string) => hashscan("transaction", id.replace("@", "-").replace(/\.(\d+)$/, "-$1"));

/** KNP-1204's real money, from its public record: each driver's stretch, paid half at the handover and half on delivery. */
const SPLIT = [
  { who: "Ramesh", leg: "Kanpur to Lucknow", km: 87, now: 22.35, held: 22.36, tx: "0.0.11325722@1793944725.308873159" },
  { who: "Suresh", leg: "Lucknow to Gorakhpur", km: 272, now: 69.89, held: 69.9, tx: "0.0.11325722@1793944729.696671174" },
];
const FEE = 22.14;
const TOTAL = 206.64;

/** Three screens from the driver's own phone (real captures from the app, 6 November). */
const STEPS = [
  { n: 1, title: "The job arrives", line: "Stretch, bus and pay, before it leaves.", shot: { src: "/shots/app-jobs.webp", alt: "Daak's Jobs tab: new jobs from Kanpur to Lucknow, 87 km, ₹44.71 with half at the handover, bus at 09:00, each with Accept and Decline" } },
  { n: 2, title: "Tap, tap, photo", line: "Sticker, badge, lid. The phone signs it.", shot: { src: "/shots/app-handover.webp", alt: "Daak's Hand over screen: tap the parcel, scan the other person's code or tap their badge, photo of the lid" } },
  { n: 3, title: "Proven, then paid", line: "0G checks the lid. Half the pay lands at once.", shot: { src: "/shots/app-paid.webp", alt: "KNP-1204 in the app: delivered, drivers paid in full, each stop checked by 0G, and ₹22.35 paid at the Lucknow handover" } },
];

const RECEIPTS: [string, string, string][] = [
  ["Booking on the public log", "topic 0.0.11327109", hashscan("topic", "0.0.11327109")],
  ["Shop's agent that paid", "0.0.11331484", hashscan("account", "0.0.11331484")],
  ["Sealed 0G checks", "6eb1ede1, 73f8e8bb, 224ee09e", "/live/KNP-1204"],
  ["Ramesh paid at Lucknow", "₹22.35", txUrl(SPLIT[0].tx)],
  ["Held pay released itself", "schedule 0.0.11335076, 11:44:00", hashscan("schedule", "0.0.11335076")],
];

/** The page's side margins, after codos.ai: full width, with room at the edges. */
const X = "px-5 sm:px-8 lg:px-16 xl:px-20";

function TrackForm({ id, dark = false }: { id: string; dark?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) router.push(`/track/${code.trim().toUpperCase()}`); }} className="flex w-full max-w-md gap-2">
      <label htmlFor={id} className="sr-only">Parcel code</label>
      <input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="KNP-1204" autoCapitalize="characters"
        className={`min-w-0 flex-1 rounded-[10px] px-4 py-3 font-mono text-base outline-none ${dark ? "bg-paper/10 text-paper placeholder:text-paper/45 focus-visible:ring-2 focus-visible:ring-lamp" : "bg-card-paper text-ink shadow-[inset_0_0_0_1.5px_var(--color-rule)] placeholder:text-muted-ink focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-ink)]"}`} />
      <button type="submit" className={`rounded-[10px] px-5 py-3 font-bold transition-transform active:scale-[0.97] ${dark ? "bg-lamp text-night" : "bg-ink text-paper shadow-[var(--shadow-key)]"}`}>Track</button>
    </form>
  );
}

/** Where KNP-1204's ₹206.64 went, as one bar: each driver's stretch by kilometre, paid now and held, then Daak's fee. */
function MoneyBar() {
  return (
    <figure className="flex flex-col gap-4">
      <div className="flex h-14 w-full overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--color-rule)]" role="img"
        aria-label={`₹${TOTAL}: Ramesh ₹44.71 for 87 km, Suresh ₹139.79 for 272 km, each half paid at the handover and half held until delivery, and Daak's fee ₹${FEE}`}>
        {SPLIT.map((s) => (
          <div key={s.who} className="flex h-full" style={{ width: `${((s.now + s.held) / TOTAL) * 100}%` }}>
            <div className="h-full bg-gold" style={{ width: "50%" }} />
            <div className="h-full bg-[repeating-linear-gradient(135deg,var(--color-gold)_0_3px,transparent_3px_8px)] opacity-70" style={{ width: "50%" }} />
          </div>
        ))}
        <div className="h-full bg-ink" style={{ width: `${(FEE / TOTAL) * 100}%` }} />
      </div>
      <figcaption className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {SPLIT.map((s) => (
          <div key={s.who} className="border-t border-rule pt-3">
            <p className="font-display text-2xl font-semibold">{s.who} <span className="font-mono text-base text-soft-ink">₹{(s.now + s.held).toFixed(2)}</span></p>
            <p className="text-soft-ink">{s.leg}, {s.km} km</p>
            <p className="mt-1 flex items-center gap-2 text-sm"><span className="size-3 rounded-[3px] bg-gold" />₹{s.now.toFixed(2)} at the handover</p>
            <p className="flex items-center gap-2 text-sm"><span className="size-3 rounded-[3px] bg-[repeating-linear-gradient(135deg,var(--color-gold)_0_2px,transparent_2px_5px)]" />₹{s.held.toFixed(2)} held, then released</p>
          </div>
        ))}
        <div className="border-t border-rule pt-3">
          <p className="font-display text-2xl font-semibold">Daak <span className="font-mono text-base text-soft-ink">₹{FEE.toFixed(2)}</span></p>
          <p className="text-soft-ink">12% booking fee</p>
          <p className="mt-1 flex items-center gap-2 text-sm"><span className="size-3 rounded-[3px] bg-ink" />Taken by the token&apos;s own fee rule</p>
        </div>
      </figcaption>
    </figure>
  );
}

/** The public face of Daak: one real parcel's day in the hero, then why, how, the money and the stack, each as a picture. */
export default function Landing() {
  const j = useJourney();
  // The film reads the hero's clock every frame without re-rendering the page.
  const filmClock = useRef({ beat: j.beat, pos: j.pos, fill: j.fill });
  filmClock.current = { beat: j.beat, pos: j.pos, fill: j.fill };
  const { data: s } = useQuery<Stats>({ queryKey: ["stats"], queryFn: () => fetch("/api/stats").then((r) => r.json()), refetchInterval: 30000 });

  return (
    <main className="w-full">
      {/* The one bold thing: night on the road, full screen, dithered, with KNP-1204's real day replayed on it. */}
      <section className="relative isolate flex min-h-svh flex-col bg-night text-paper">
        {/* The film: dawn on the road, drawn live, following KNP-1204's real day. Ink falls darker behind the words. */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(20_18_14/0.92)_10%,rgb(20_18_14/0.55)_42%,transparent_70%)] max-lg:hidden" aria-hidden />
        <p className="sr-only">{FILM_ALT}</p>
        <div className={`${X} pt-6 sm:pt-8`}><SiteNav dark className="" /></div>
        <div className={`${X} grid flex-1 grid-cols-1 content-center gap-12 py-14 lg:grid-cols-12 lg:items-center lg:gap-16`}>
          <div className="lg:col-span-5">
            <h1 className="font-display text-5xl font-medium leading-[0.98] tracking-tight sm:text-7xl 2xl:text-8xl">Every parcel handoff, on the record.</h1>
            <p lang="hi" className="mt-6 text-2xl text-paper/75 sm:text-3xl">हर पार्सल का हिसाब।</p>
            <p className="mt-6 max-w-md text-lg text-paper/70">Proof at every bus stand. Drivers paid by the kilometre the moment they hand over.</p>
            <div className="mt-10"><TrackForm id="code" dark /></div>
          </div>

        </div>
        {/* Behind everything on a wide screen; on a phone, a band of its own between the words and the caption. */}
        <div className="relative h-[44svh] lg:absolute lg:inset-0 lg:-z-20 lg:h-auto"><HeroFilm clock={filmClock} /></div>
        <div className={`${X} grid grid-cols-1 gap-8 border-t border-paper/10 py-8 sm:py-10 lg:grid-cols-12 lg:items-end lg:gap-16`}>
          <div className="lg:col-span-6"><JourneyCaption j={j} /></div>
          <div className="lg:col-span-6"><JourneySteps j={j} /></div>
        </div>
      </section>

      <section aria-label="Live from the public log" className={`${X} grid grid-cols-2 gap-x-8 gap-y-10 border-b border-rule py-16 sm:py-20 lg:grid-cols-4`}>
        {[
          [s?.handoffs ?? "–", "handoffs on record"],
          [s ? `${s.km}` : "–", "km carried and proven"],
          [s ? `₹${Math.round(s.paidOut)}` : "–", "redeemed by drivers"],
          [s?.bookings ?? "–", "bookings paid by agents"],
        ].map(([n, label]) => (
          <div key={String(label)}>
            <p className="font-display text-5xl font-medium tabular-nums leading-none sm:text-6xl">{n}</p>
            <p className="mt-2 text-soft-ink">{label}</p>
          </div>
        ))}
        {s?.topicId && <a className="col-span-2 text-sm font-semibold text-gold-deep underline decoration-rule decoration-2 underline-offset-4 hover:decoration-gold lg:col-span-4" href={hashscan("topic", s.topicId)} target="_blank" rel="noreferrer">Counted live from Daak&apos;s public Hedera log. Read it yourself</a>}
      </section>

      <MorphStory />

      <div className={X}>
        <section aria-labelledby="how" className="py-24 sm:py-32">
          <h2 id="how" className="max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">A handoff takes three taps.</h2>
          <ol className="mt-16 grid grid-cols-1 gap-14 sm:grid-cols-3 lg:gap-20">
            {STEPS.map((x) => (
              <li key={x.n} className="flex flex-col gap-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl font-medium text-gold">{x.n}</span>
                  <div>
                    <p className="font-display text-2xl font-semibold">{x.title}</p>
                    <p className="text-soft-ink">{x.line}</p>
                  </div>
                </div>
                <PhoneFrame src={x.shot.src} alt={x.shot.alt} className="mt-4" />
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="money" className="border-t border-rule py-24 sm:py-32">
          <div className="mb-14 flex flex-col gap-3">
            <h2 id="money" className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Where ₹206.64 went.</h2>
            <p className="text-lg text-soft-ink">KNP-1204, Kanpur to Gorakhpur, 359 km on two buses.</p>
          </div>
          <MoneyBar />
        </section>

        <section aria-labelledby="market" className="border-t border-rule py-24 sm:py-32">
          <div className="mb-14 flex flex-col gap-3">
            <h2 id="market" className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">State buses already carry parcels for money.</h2>
            <p className="text-lg text-soft-ink">In the transport corporations' own numbers, with a link to each.</p>
          </div>
          <Market />
        </section>

        <section aria-labelledby="stack" className="border-t border-rule py-24 sm:py-32">
          <div className="mb-14 flex flex-col gap-3">
            <h2 id="stack" className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Where each partner comes in.</h2>
            <p className="text-lg text-soft-ink">Every call, in order. Nobody on the route sees a wallet or a token.</p>
          </div>
          <Architecture />
        </section>

        <section aria-labelledby="proof" className="grid grid-cols-1 gap-8 border-t border-rule py-24 sm:py-32 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="proof" className="font-display text-4xl font-semibold leading-tight tracking-tight">Check it yourself.</h2>
            <p className="mt-2 text-lg text-soft-ink">Every receipt for KNP-1204 is public.</p>
          </div>
          <dl className="divide-y divide-rule border-y border-rule lg:col-span-8">
            {RECEIPTS.map(([label, value, href]) => (
              <div key={label} className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="text-soft-ink">{label}</dt>
                <dd><a href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="font-mono text-sm text-gold-deep underline decoration-rule decoration-2 underline-offset-4 hover:decoration-gold">{value}</a></dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid grid-cols-1 gap-8 border-t border-rule py-24 sm:py-32 md:grid-cols-3">
          {[
            ["Drivers", "Paid per km at every handover, and a record of proven work that raises their share."],
            ["Shops", "One published rate, a photo at every stand, and a refund from the responsible driver's held pay."],
            ["Receiving shops", "Tap the parcel with any phone. No app, no account."],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-display text-2xl font-semibold">{t}</p>
              <p className="mt-2 text-soft-ink">{d}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="bg-night text-paper">
        <div className={`${X} grid grid-cols-1 gap-10 py-20 lg:grid-cols-12 lg:items-end`}>
          <div className="lg:col-span-7">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Named after the dak, the relay that carried India&apos;s post.</h2>
            <p className="mt-3 max-w-xl text-paper/70">Same relay. Now every hand signs, and every hand gets paid.</p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5">
            <TrackForm id="code2" dark />
            <div className="flex flex-wrap gap-2">
              {[["/live", "Live deliveries"], ["/network", "Network map"], ["/drivers", "Drivers"], ["https://github.com/adilhusain01/daak", "Source on GitHub"]].map(([href, label]) => (
                <a key={href} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                  className="rounded-md bg-paper/10 px-3 py-2 text-sm font-semibold transition-transform hover:bg-paper/15 active:scale-[0.97]">{label}</a>
              ))}
            </div>
          </div>
          <footer className="flex flex-col gap-2 border-t border-paper/15 pt-6 text-sm text-paper/60 sm:flex-row sm:justify-between lg:col-span-12">
            <span>Built at ETHGlobal Mumbai 2026. Testnet, MIT licence.</span>
            <span>Data: India Post (GODL-India), OpenStreetMap, OSRM. Logos belong to Hedera, 0G, Arkiv and Swarm.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
