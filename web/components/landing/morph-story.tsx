"use client";

import { useEffect, useRef, useState } from "react";
import { ROUTE } from "@/components/landing/route";

/**
 * The problem and the answer in four lines, after codos.ai: one cloud of dots stays on screen while the statements
 * scroll past, and the cloud re-forms for each one. Parcels scattered with no record, then the real road with its
 * three stands, then the rupee, then a seal. Gold dots are proven handoffs; their share grows as the story goes.
 * With reduced motion the cloud jumps between shapes and never drifts.
 */
const STEPS = [
  { title: "A parcel in UP changes hands three times.", line: "Two buses, three people, and no receipt at any stand.", tint: "#ece5d3", gold: 0.04 },
  { title: "Daak turns every stand into a receipt.", line: "Tap the sticker, tap the badge, photograph the lid. The phone signs it.", tint: "#e8e0ca", gold: 0.16 },
  { title: "Every driver is paid by the kilometre.", line: "By the km and the parcel's weight. Part at the handover, the rest on delivery.", tint: "#e5dcc6", gold: 0.34 },
  { title: "All of it is on the public record.", line: "Anyone can check a handoff on Hedera. Nobody can quietly change one.", tint: "#eee7d5", gold: 0.62 },
] as const;

type Pt = [number, number];
const GRID = 260; // the drawing canvas the shapes are sampled from, in its own units

/** Draws one shape on a small canvas and returns n points inside it, in -1..1 on both axes. */
function sample(n: number, draw: (c: CanvasRenderingContext2D) => void, seed: number): Pt[] {
  const cv = document.createElement("canvas");
  cv.width = cv.height = GRID;
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.fillStyle = c.strokeStyle = "#000";
  draw(c);
  const px = c.getImageData(0, 0, GRID, GRID).data;
  const inside: Pt[] = [];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (px[(y * GRID + x) * 4 + 3] > 120) inside.push([x, y]);
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => {
    const [x, y] = inside[Math.floor(rnd() * inside.length)] ?? [GRID / 2, GRID / 2];
    return [((x + rnd()) / GRID) * 2 - 1, ((y + rnd()) / GRID) * 2 - 1];
  });
}

function shapes(n: number, serif: string): Pt[][] {
  // 1. Parcels everywhere: loose clumps with nothing joining them.
  const scatter = sample(n, (c) => {
    const spots = [[52, 70], [128, 46], [206, 82], [86, 150], [170, 136], [222, 196], [46, 214], [132, 214]];
    spots.forEach(([x, y], i) => { c.beginPath(); c.arc(x, y, 15 + (i % 3) * 5, 0, Math.PI * 2); c.fill(); });
  }, 7);
  // 2. The real road, Kanpur to Lucknow to Gorakhpur, with its three stands.
  const road = sample(n, (c) => {
    const s = (GRID - 30) / ROUTE.width;
    c.save(); c.translate(15, GRID / 2 - (ROUTE.height * s) / 2); c.scale(s, s);
    c.lineWidth = 26; c.lineCap = c.lineJoin = "round"; c.stroke(new Path2D(ROUTE.d));
    Object.values(ROUTE.stops).forEach(([x, y]) => c.fillRect(x - 34, y - 34, 68, 68));
    c.restore();
  }, 11);
  // 3. The rupee.
  const rupee = sample(n, (c) => {
    c.font = `${GRID * 0.92}px ${serif}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("₹", GRID / 2, GRID / 2 + 8);
  }, 13);
  // 4. A seal: a ring and a tick.
  const seal = sample(n, (c) => {
    c.lineWidth = 22; c.beginPath(); c.arc(GRID / 2, GRID / 2, 100, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 28; c.lineCap = c.lineJoin = "round"; c.beginPath(); c.moveTo(78, 134); c.lineTo(114, 170); c.lineTo(184, 96); c.stroke();
  }, 17);
  return [scatter, road, rupee, seal];
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function MorphStory() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = section.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = window.innerWidth < 640 ? 900 : 1500;
    let targets: Pt[][] | null = null;
    const pos = new Float32Array(n * 2);
    const seeds = Float32Array.from({ length: n }, (_, i) => (Math.sin(i * 91.7) * 43758.5) % 1);
    let raf = 0, visible = false, w = 0, h = 0, progress = 0;

    const fit = () => {
      const r = cv.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height; cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const read = () => {
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      progress = Math.max(0, Math.min(STEPS.length - 1, (-r.top / Math.max(1, span)) * (STEPS.length - 1)));
      setStep(Math.min(STEPS.length - 1, Math.round(progress)));
    };
    const frame = (now: number) => {
      raf = 0;
      if (!targets) return;
      const at = reduce ? Math.round(progress) : progress;
      const i0 = Math.floor(at), i1 = Math.min(STEPS.length - 1, i0 + 1), f = ease(at - i0);
      const A = targets[i0], B = targets[i1];
      const R = Math.min(w * 0.46, h * 0.48), cx = w / 2, cy = h / 2;
      const goldShare = STEPS[i0].gold + (STEPS[i1].gold - STEPS[i0].gold) * f;
      // The road is long and flat: draw it wider than the other shapes, as far as the canvas allows.
      const grow = (i: number) => (i === 1 ? Math.min(1.35, (w / 2 - 8) / (R * 0.9)) : 1);
      const k0 = grow(i0), k1 = grow(i1);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        const tx = cx + (A[i][0] * k0 + (B[i][0] * k1 - A[i][0] * k0) * f) * R, ty = cy + (A[i][1] * k0 + (B[i][1] * k1 - A[i][1] * k0) * f) * R;
        let x = pos[i * 2], y = pos[i * 2 + 1];
        if (reduce || (x === 0 && y === 0)) { x = tx; y = ty; } else { x += (tx - x) * 0.14; y += (ty - y) * 0.14; }
        pos[i * 2] = x; pos[i * 2 + 1] = y;
        const j = reduce ? 0 : Math.sin(now / 900 + seeds[i] * 40) * 0.9;
        ctx.fillStyle = (i / n) < goldShare ? "rgba(168,126,54,0.95)" : "rgba(28,26,20,0.78)";
        const s = 1.4 + (seeds[i] > 0.6 ? 0.8 : 0);
        ctx.fillRect(x + j, y - j, s, s);
      }
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const serif = getComputedStyle(document.body).getPropertyValue("--font-tiro") || "serif";
    document.fonts.load(`100px ${serif}`, "₹").catch(() => null).then(() => { targets = shapes(n, `${serif}, serif`); fit(); read(); kick(); });
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
    io.observe(el);
    const onScroll = () => { read(); kick(); };
    const onResize = () => { fit(); read(); kick(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, []);

  const s = STEPS[step];
  return (
    <section ref={section} aria-label="Why Daak" style={{ height: `${STEPS.length * 90 + 30}svh` }} className="relative">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center gap-6 px-4 transition-colors duration-700 ease-out" style={{ backgroundColor: s.tint }}>
        <canvas ref={canvas} aria-hidden className="h-[min(46svh,420px)] w-full max-w-[560px]" />
        <div className="min-h-[9.5rem] max-w-2xl text-center sm:min-h-[8.5rem]">
          <p key={step} className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-balance motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 sm:text-5xl">{s.title}</p>
          <p key={`l${step}`} className="mx-auto mt-3 max-w-xl text-lg text-balance text-soft-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">{s.line}</p>
        </div>
        <ol className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => <li key={i} className={`h-1 rounded-sm transition-[width,background-color] duration-300 ${i === step ? "w-8 bg-gold" : "w-3 bg-rule"}`} />)}
        </ol>
      </div>
      {/* The four lines in the page as well, for anyone reading without the animation. */}
      <ul className="sr-only">{STEPS.map((x) => <li key={x.title}>{x.title} {x.line}</li>)}</ul>
    </section>
  );
}
