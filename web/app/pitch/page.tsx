"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DaakMark } from "@/components/daak-mark";
import { ROUTE } from "@/components/landing/route";

const Dither = dynamic(() => import("@/components/dither"), { ssr: false });

/**
 * The four pitch slides (problem, how it works, business, ask), in the site's own theme. Every size is in container
 * units, so a slide scales to any screen at 16:9. Arrow keys, space or a click move on; F is full screen; printing
 * gives one landscape page a slide. At most four points a slide (ETHGlobal's rule). Numbers are KNP-1204's public
 * record and the transport corporations' own figures (sources in docs/business.md).
 */
const LOGOS = [
  { src: "/logos/hedera.svg", alt: "Hedera", w: 4, text: "Hedera" },
  { src: "/logos/0g.svg", alt: "0G", w: 8 },
  { src: "/logos/arkiv.svg", alt: "Arkiv", w: 15 },
  { src: "/logos/swarm.svg", alt: "Swarm", w: 14 },
];

function Frame({ n, dark = false, children }: { n: number; dark?: boolean; children: React.ReactNode }) {
  return (
    <section className={`slide relative isolate aspect-video w-full overflow-hidden [container-type:inline-size] ${dark ? "bg-night text-paper" : "paper-grain bg-paper text-ink"}`}>
      <div className="absolute inset-0 flex flex-col px-[6cqw] pb-[4.5cqw] pt-[4.5cqw]">
        {children}
        <footer className={`mt-auto flex items-center justify-between text-[1.1cqw] ${dark ? "text-paper/55" : "text-muted-ink"}`}>
          <span className="flex items-center gap-[0.8cqw]"><DaakMark className={`size-[2.2cqw] rounded-[0.4cqw] ${dark ? "ring-1 ring-paper/25" : ""}`} /><span className="font-display text-[1.6cqw] font-semibold">Daak</span></span>
          <span className="font-mono">{n} / 4</span>
        </footer>
      </div>
    </section>
  );
}

function Problem() {
  const stops = [["Kanpur", "KNP"], ["Lucknow", "LKO"], ["Gorakhpur", "GKP"]] as const;
  return (
    <Frame n={1} dark>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-35"><Dither waveColor={[0.26, 0.22, 0.14]} backgroundColor="transparent" colorNum={3} pixelSize={3} waveSpeed={0.02} waveFrequency={1.6} waveAmplitude={0.22} enableMouseInteraction={false} clickRipple={false} intro={false} /></div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--color-night)_20%,rgb(28_26_20/0.5)_60%,transparent)]" />
      <h1 className="max-w-[60cqw] font-display text-[5.6cqw] font-medium leading-[0.98] tracking-tight">A parcel changes hands three times. Nobody signs.</h1>
      <div className="mt-[3cqw] grid grid-cols-12 gap-[3cqw]">
        <ul className="col-span-5 flex flex-col gap-[1.4cqw] text-[1.75cqw] leading-snug text-paper/80">
          <li>Two buses, three pairs of hands, no receipt at any stand.</li>
          <li>Every driver quotes his own rate.</li>
          <li>Pay is cash, days late, written down nowhere.</li>
          <li>A torn parcel belongs to no one, so the shop pays.</li>
        </ul>
        <svg viewBox={`0 -60 ${ROUTE.width} ${ROUTE.height + 120}`} className="col-span-7 w-full overflow-visible" aria-label="The road from Kanpur to Lucknow to Gorakhpur, with no receipt at any stand">
          <path d={ROUTE.d} fill="none" className="stroke-paper/25" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
          {stops.map(([name, id]) => {
            const [x, y] = ROUTE.stops[id];
            return (
              <g key={id}>
                <rect x={x - 12} y={y - 12} width={24} height={24} rx={5} className="fill-night stroke-held" strokeWidth={3} />
                <path d={`M${x - 6} ${y - 6} L${x + 6} ${y + 6} M${x + 6} ${y - 6} L${x - 6} ${y + 6}`} className="stroke-held" strokeWidth={3} />
                <text x={x} y={id === "KNP" ? y + 58 : y - 32} textAnchor={id === "GKP" ? "end" : id === "KNP" ? "start" : "middle"} className="fill-paper font-display" fontSize={34}>{name}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </Frame>
  );
}

function How() {
  const steps = [
    { n: "1", t: "Tap", d: "Sticker, badge, lid photo. The phone's own key signs it.", tech: "Android Keystore" },
    { n: "2", t: "Check", d: "A sealed AI reads the code on the lid and the parcel's state.", tech: "0G compute, TEE" },
    { n: "3", t: "Record", d: "Every handoff on a public log, the photo encrypted.", tech: "Hedera HCS, Arkiv, Swarm" },
    { n: "4", t: "Pay", d: "Half the stretch at once. The rest releases itself on delivery.", tech: "Hedera HTS, scheduled tx" },
  ];
  return (
    <Frame n={2}>
      <h1 className="max-w-[70cqw] font-display text-[5cqw] font-semibold leading-[1.02] tracking-tight">Three taps at the stand. Paid at the handover.</h1>
      <ol className="mt-[4cqw] grid grid-cols-4 gap-[2.4cqw]">
        {steps.map((s, i) => (
          <li key={s.n} className="relative flex flex-col gap-[1cqw] border-t-[0.35cqw] border-gold pt-[1.6cqw]">
            {i < steps.length - 1 && <span aria-hidden className="absolute -right-[2cqw] top-[-0.95cqw] text-[1.6cqw] text-gold">→</span>}
            <span className="font-display text-[4.2cqw] font-medium leading-none text-gold">{s.n}</span>
            <p className="font-display text-[2.6cqw] font-semibold leading-none">{s.t}</p>
            <p className="text-[1.5cqw] leading-snug text-soft-ink">{s.d}</p>
            <p className="font-mono text-[1.1cqw] text-muted-ink">{s.tech}</p>
          </li>
        ))}
      </ol>
      <div className="mt-[4cqw] flex items-center gap-[3.5cqw] border-t border-rule pt-[2.4cqw]">
        {LOGOS.map((l) => (
          <span key={l.alt} className="flex items-center gap-[0.6cqw]">
            <img src={l.src} alt={l.alt} style={{ width: `${l.w}cqw` }} className="h-auto" />
            {l.text && <span className="text-[1.9cqw] font-bold">{l.text}</span>}
          </span>
        ))}
        <span className="ml-auto text-[1.3cqw] text-soft-ink">Nobody on the route sees a wallet or a token.</span>
      </div>
    </Frame>
  );
}

function Business() {
  const total = 206.64, drivers = 184.5, fee = 22.14;
  const bars = [["Andhra Pradesh", 219, "~₹219 cr"], ["Telangana", 90, "₹90 cr"], ["Maharashtra", 31.16, "₹31 cr"], ["Uttar Pradesh", 3, "₹3 cr floor"]] as const;
  return (
    <Frame n={3}>
      <h1 className="max-w-[72cqw] font-display text-[5cqw] font-semibold leading-[1.02] tracking-tight">Daak earns on every parcel the buses already carry.</h1>
      <div className="mt-[3.5cqw] grid grid-cols-2 gap-[5cqw]">
        <div className="flex flex-col gap-[1.6cqw]">
          <p className="text-[1.4cqw] text-soft-ink">One real parcel, KNP-1204, 359 km</p>
          <div className="flex h-[4cqw] overflow-hidden rounded-[0.6cqw]" role="img" aria-label={`₹${total}: ₹${drivers} to drivers, ₹${fee} to Daak`}>
            <div className="bg-gold" style={{ width: `${(drivers / total) * 100}%` }} />
            <div className="bg-ink" style={{ width: `${(fee / total) * 100}%` }} />
          </div>
          <ul className="flex flex-col gap-[1cqw] text-[1.6cqw] leading-snug">
            <li><span className="font-mono">₹184.50</span> to the two drivers, by the km</li>
            <li><span className="font-mono">₹22.14</span> booking fee to Daak, plus 2% of each payout</li>
            <li>First market: daily B2B on one UP corridor (dairy, flowers, bakery)</li>
            <li>Reach: bus booking offices, then courier franchises</li>
          </ul>
        </div>
        <div className="flex flex-col gap-[1.1cqw]">
          <p className="text-[1.4cqw] text-soft-ink">What state buses earn from parcels, a year</p>
          {bars.map(([state, v, label]) => (
            <div key={state} className="grid grid-cols-[17cqw_1fr_9cqw] items-center gap-[1.2cqw]">
              <span className="font-display text-[1.8cqw] font-semibold">{state}</span>
              <span className="h-[2cqw] bg-tray/70"><span className={`block h-full ${state === "Uttar Pradesh" ? "bg-ink" : "bg-gold"}`} style={{ width: `${Math.max(1.5, (v / 219) * 100)}%` }} /></span>
              <span className="whitespace-nowrap font-mono text-[1.4cqw]">{label}</span>
            </div>
          ))}
          <p className="mt-[0.6cqw] text-[1.15cqw] leading-snug text-muted-ink">APSRTC ₹60 lakh a day (The Hans India, Dec 2024), TSRTC 2022 (Telangana Today), MSRTC goods 2022-23 (RTI), UPSRTC tender reserve price (2022). UP: 12,000+ buses.</p>
        </div>
      </div>
    </Frame>
  );
}

function Ask() {
  return (
    <Frame n={4} dark>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-35"><Dither waveColor={[0.26, 0.22, 0.14]} backgroundColor="transparent" colorNum={3} pixelSize={3} waveSpeed={0.02} waveFrequency={1.6} waveAmplitude={0.22} enableMouseInteraction={false} clickRipple={false} intro={false} /></div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--color-night)_25%,rgb(28_26_20/0.55)_65%,transparent)]" />
      <h1 className="max-w-[62cqw] font-display text-[5.6cqw] font-medium leading-[0.98] tracking-tight">One UP corridor. Thirty days.</h1>
      <ul className="mt-[3.5cqw] flex max-w-[58cqw] flex-col gap-[1.5cqw] text-[1.9cqw] leading-snug text-paper/85">
        <li>A pilot from Kanpur to Lucknow to Gorakhpur with five daily senders.</li>
        <li>An introduction to the agent that holds UPSRTC&apos;s parcel rights.</li>
        <li>A UPI payout partner, so drivers are paid to the bank directly.</li>
        <li>Mainnet credits on Hedera and 0G to run the corridor in public.</li>
      </ul>
      <p className="mt-[4cqw] font-display text-[3cqw] text-lamp">Porter, for the buses that already run.</p>
      <p className="mt-[1cqw] font-mono text-[1.4cqw] text-paper/70">daak-ethglobal.vercel.app · github.com/adilhusain01/daak</p>
    </Frame>
  );
}

const SLIDES = [Problem, How, Business, Ask];

export default function Pitch() {
  const [i, setI] = useState(0);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(SLIDES.length - 1, x + d))), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      if (e.key === "Home") setI(0);
      if (e.key === "End") setI(SLIDES.length - 1);
      if (e.key.toLowerCase() === "f") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go]);
  const S = SLIDES[i];
  return (
    <main className="deck flex min-h-svh items-center justify-center bg-night p-0">
      {/* On screen: one slide, as large as 16:9 allows. Printed: every slide, one a page. */}
      <div className="screen-only w-[min(100vw,177.78svh)] cursor-pointer select-none" onClick={(e) => go(e.clientX < window.innerWidth / 3 ? -1 : 1)}>
        <S />
      </div>
      <div className="print-only">{SLIDES.map((X, k) => <div key={k} className="print-page"><X /></div>)}</div>
      <style>{`
        .print-only { display: none; }
        @media print {
          @page { size: 1920px 1080px; margin: 0; }
          body { background: none !important; }
          .screen-only { display: none; }
          .print-only { display: block; }
          .deck { display: block; min-height: 0; background: none; }
          .print-page { width: 1920px; height: 1080px; break-after: page; }
          .slide { width: 1920px; }
        }
      `}</style>
    </main>
  );
}
