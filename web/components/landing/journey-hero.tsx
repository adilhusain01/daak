"use client";

import { useEffect, useRef, useState } from "react";
import { ROUTE } from "@/components/landing/route";

/**
 * KNP-1204's real day, replayed on the real road. The hero's one moving thing: the parcel travels, the road turns
 * gold behind it, and a thin stepper under the caption fills as each beat plays. Every number is from its public log.
 */
const BEATS = [
  { at: 0, step: "Book", place: "Kanpur, 7:04 am", title: "Booked and paid", body: "The shop's agent paid ₹206.64 for 359 km. Nobody approved it.", stack: "Hedera x402, dINR" },
  { at: 0, step: "Hand over", place: "Kanpur stand", title: "Handed to Ramesh", body: "Sticker, badge, lid photo. The phone signs it.", stack: "Android Keystore, Swarm, Arkiv" },
  { at: 0, step: "Check", place: "Kanpur stand", title: "Checked by a sealed AI", body: "0G read the lid inside a TEE: right code, still sealed.", stack: "0G compute" },
  { at: ROUTE.lucknowAt, step: "Pay", place: "Lucknow, 87 km", title: "Ramesh paid at the handover", body: "₹22.35 the moment Suresh confirmed. The rest waits for delivery.", stack: "Hedera token transfer" },
  { at: 1, step: "Deliver", place: "Gorakhpur, 272 km more", title: "Delivered. The held pay released itself", body: "At 11:44 Hedera paid out the ₹92.26 still held. No server sent it.", stack: "Hedera scheduled transaction" },
];
const BEAT_MS = 4200;

/** The road and the parcel, drawn over the ink. */
export function JourneyRoad({ pos }: { pos: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const [samples, setSamples] = useState<{ x: number; y: number }[]>([]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const L = el.getTotalLength(); setLen(L);
    setSamples(Array.from({ length: 501 }, (_, i) => { const p = el.getPointAtLength((i / 500) * L); return { x: p.x, y: p.y }; }));
  }, []);
  const point = samples.length ? samples[Math.round(pos * 500)] : { x: ROUTE.stops.KNP[0], y: ROUTE.stops.KNP[1] };
  const reached = (at: number) => pos >= at - 0.001;
  return (
    <svg viewBox={`0 -40 ${ROUTE.width} ${ROUTE.height + 110}`} className="w-full overflow-visible" role="img" aria-label="The road from Kanpur to Gorakhpur via Lucknow, 359 km, with parcel KNP-1204 on it">
      <path d={ROUTE.d} fill="none" className="stroke-paper/15 max-sm:[stroke-width:14]" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={ref} d={ROUTE.d} fill="none" className="stroke-lamp max-sm:[stroke-width:8]" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={len || 1} strokeDashoffset={len ? len * (1 - pos) : 1} />
      {([["KNP", "Kanpur", 0, "start"], ["LKO", "Lucknow", ROUTE.lucknowAt, "middle"], ["GKP", "Gorakhpur", 1, "end"]] as const).map(([id, name, at, anchor]) => {
        const [x, y] = ROUTE.stops[id];
        const on = reached(at);
        return (
          <g key={id}>
            <rect x={x - 8} y={y - 8} width={16} height={16} rx={4} style={{ transformBox: "fill-box", transformOrigin: "center" }} className={`max-sm:scale-[1.8] transition-colors duration-300 ${on ? "fill-lamp" : "fill-night stroke-paper/40"}`} strokeWidth={2} />
            <text x={x} y={id === "KNP" ? y + 50 : y - 24} textAnchor={anchor} className={`font-display text-[26px] font-medium max-sm:text-[50px] transition-colors duration-300 ${on ? "fill-paper" : "fill-paper/45"}`}>{name}</text>
          </g>
        );
      })}
      <g transform={`translate(${point.x} ${point.y})`}>
        <g className="max-sm:scale-[1.9]" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <rect x={-14} y={-14} width={28} height={28} rx={5} className="fill-paper" />
          <path d="M-14 -3 H14" className="stroke-gold" strokeWidth={4} />
        </g>
      </g>
    </svg>
  );
}

/** The clock, the road, the caption and the stepper, laid out by the hero. */
export function useJourney() {
  const [beat, setBeat] = useState(0);
  const [pos, setPos] = useState(0);
  const [fill, setFill] = useState(0); // 0..1 through the current beat, for the stepper
  const [playing, setPlaying] = useState(true);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setPlaying(false); setBeat(BEATS.length - 1); setPos(1); setFill(1); }
  }, []);

  useEffect(() => {
    if (!playing || still) return;
    let raf = 0;
    const start = performance.now() - beat * BEAT_MS;
    const tick = (now: number) => {
      const total = BEATS.length * BEAT_MS;
      const t = (((now - start) % total) + total) % total;
      const i = Math.max(0, Math.min(BEATS.length - 1, Math.floor(t / BEAT_MS)));
      const inBeat = (t - i * BEAT_MS) / BEAT_MS;
      const within = Math.min(1, inBeat / 0.5);
      const from = BEATS[Math.max(0, i - 1)].at, to = BEATS[i].at;
      setBeat(i); setFill(inBeat);
      setPos(i === 0 ? 0 : from + (to - from) * (1 - Math.pow(1 - within, 3)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, still]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (i: number) => { setPlaying(false); setBeat(i); setPos(BEATS[i].at); setFill(1); };
  return { beat, pos, fill, playing, still, choose, toggle: () => setPlaying((p) => !p), b: BEATS[beat] };
}

export function JourneyCaption({ j }: { j: ReturnType<typeof useJourney> }) {
  return (
    <div aria-live="polite" className="max-w-2xl">
      <p className="text-sm text-lamp">{j.b.place}</p>
      <p className="mt-1 font-display text-3xl font-medium leading-tight text-paper sm:text-4xl">{j.b.title}</p>
      <p className="mt-2 text-paper/70">{j.b.body} <span className="font-mono text-xs text-paper/45">{j.b.stack}</span></p>
    </div>
  );
}

/** Five steps, each a label over a thin bar that fills while it plays; press one to stop there. */
export function JourneySteps({ j }: { j: ReturnType<typeof useJourney> }) {
  return (
    <div className="flex items-end gap-3">
      <div className="grid flex-1 grid-cols-5 gap-2" role="group" aria-label="Steps of KNP-1204's journey">
        {BEATS.map((x, i) => (
          <button key={x.step} onClick={() => j.choose(i)} aria-pressed={j.beat === i}
            className={`group flex flex-col gap-2 pt-2 text-left text-xs font-semibold transition-colors sm:text-sm ${j.beat === i ? "text-paper" : "text-paper/50 hover:text-paper/80"}`}>
            <span className="truncate">{x.step}</span>
            <span className="h-0.5 w-full overflow-hidden bg-paper/15">
              <span className="block h-full bg-lamp" style={{ width: `${i < j.beat ? 100 : i === j.beat ? j.fill * 100 : 0}%` }} />
            </span>
          </button>
        ))}
      </div>
      {!j.still && (
        <button onClick={j.toggle} aria-label={j.playing ? "Pause the journey" : "Play the journey"}
          className="grid size-9 shrink-0 place-items-center rounded-md text-paper/70 shadow-[inset_0_0_0_1px_rgb(236_229_211_/_0.25)] transition-transform hover:text-paper active:scale-95">
          {j.playing
            ? <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
            : <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden><path d="M4 2.5v11l9-5.5z" /></svg>}
        </button>
      )}
    </div>
  );
}
