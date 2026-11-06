"use client";

import { useEffect, useRef } from "react";
import { ROUTE } from "@/components/landing/route";

/**
 * The hero's film, every frame drawn in code: dawn on the road from Kanpur to Gorakhpur. Layered paper-cut hills
 * slide at their own depth as the camera follows a state bus; dust drifts in the low sun; grass sways in front.
 * It plays KNP-1204's real day, driven by the hero's clock (the caption and stepper below it):
 * book at Kanpur, the handoff, the sealed check (a gold ring), paid at Lucknow (gold rising), delivered at Gorakhpur
 * (gold running back along the road as the held pay releases). Reduced motion draws one still frame.
 */
type Clock = { beat: number; pos: number; fill: number };

const INK = "#1c1a14";
const GOLD = [201, 161, 90] as const;
const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Seeded noise for the hill outlines, so every layer keeps its shape across frames and resizes. */
function ridge(seed: number) {
  const r = (n: number) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return r(i) * (1 - u) + r(i + 1) * u; };
  return (x: number) => smooth(x) * 0.55 + smooth(x * 2.3 + 7) * 0.28 + smooth(x * 5.1 + 3) * 0.12 + smooth(x * 11 + 1) * 0.05;
}

// Far to near: warm and hazy in the sun, darker as they come close, like cut paper stacked in light.
const LAYERS = [
  { p: 0.05, base: 0.5, amp: 0.2, freq: 2.0, color: [118, 92, 56], seed: 1 },
  { p: 0.12, base: 0.54, amp: 0.17, freq: 2.8, color: [86, 68, 43], seed: 2 },
  { p: 0.22, base: 0.585, amp: 0.14, freq: 3.6, color: [60, 49, 33], seed: 3 },
  { p: 0.36, base: 0.63, amp: 0.1, freq: 4.6, color: [41, 35, 25], seed: 4 },
  { p: 0.55, base: 0.665, amp: 0.06, freq: 6.0, color: [29, 26, 19], seed: 5 },
] as const;
const GROUND = 0.69;

export function HeroFilm({ clock }: { clock: React.RefObject<Clock> }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, worldW = 0, dpr = 1, raf = 0, visible = true, camX = 0;
    let layers: HTMLCanvasElement[] = [];
    const stands = { KNP: 0, LKO: 0, GKP: 0 };
    const motes = Array.from({ length: 140 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, s: Math.random(), gold: i % 7 === 0 }));
    const blades = Array.from({ length: 520 }, () => ({ x: Math.random(), hgt: 0.4 + Math.random() * 0.6, lean: (Math.random() - 0.5) * 0.5, ph: Math.random() * 6.28 }));
    const rising: { x: number; y: number; vy: number; life: number }[] = [];
    let lastBeat = -1, lastT = 0, first = true;

    // The display face, read from the page, for the names of the stands.
    const serif = `${getComputedStyle(document.body).getPropertyValue("--font-bodoni") || "Georgia"}, Georgia, serif`;
    const build = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      worldW = Math.max(w * 2.4, 1800);
      stands.KNP = w * 0.62; stands.LKO = w * 0.62 + (worldW - w * 1.07) * ROUTE.lucknowAt; stands.GKP = worldW - w * 0.45;
      // Each hill layer is drawn once to its own canvas (with its paper-cut shadow and lit edge), then only slid.
      layers = LAYERS.map((L) => {
        const lw = Math.ceil(w + (worldW - w) * L.p + 40), c = document.createElement("canvas");
        c.width = Math.ceil(lw * dpr); c.height = Math.ceil(h * dpr);
        const g = c.getContext("2d")!; g.scale(dpr, dpr);
        const f = ridge(L.seed);
        g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= lw; x += 6) g.lineTo(x, h * L.base - f((x / w) * L.freq) * h * L.amp);
        g.lineTo(lw, h); g.closePath();
        g.save(); g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 24; g.shadowOffsetY = -4;
        const grad = g.createLinearGradient(0, h * (L.base - L.amp), 0, h);
        grad.addColorStop(0, rgba(L.color, 1)); grad.addColorStop(1, rgba(L.color.map((v) => v * 0.7), 1));
        g.fillStyle = grad; g.fill(); g.restore();
        g.strokeStyle = rgba(GOLD, 0.1); g.lineWidth = 1.2; g.stroke();
        // Neem and acacia cut into the two nearest layers: a trunk and a flat, wide crown.
        if (L.seed >= 4) {
          const rnd = ridge(L.seed + 10);
          g.fillStyle = rgba(L.color.map((v) => v * 0.8), 1);
          for (let x = 40; x < lw; x += w * (L.seed === 5 ? 0.21 : 0.13)) {
            const jx = x + (rnd(x * 0.01) - 0.5) * w * 0.08, top = h * L.base - f((jx / w) * L.freq) * h * L.amp;
            const th = h * (L.seed === 5 ? 0.075 : 0.05) * (0.7 + rnd(x * 0.03) * 0.6);
            g.fillRect(jx - 1.5, top - th, 3, th + 4);
            g.beginPath(); g.ellipse(jx, top - th, th * 0.9, th * 0.32, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(jx - th * 0.45, top - th * 0.88, th * 0.5, th * 0.24, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(jx + th * 0.5, top - th * 0.9, th * 0.48, th * 0.22, 0, 0, Math.PI * 2); g.fill();
          }
        }
        return c;
      });
    };

    /**
     * Two buses, as on KNP-1204's real day: Ramesh drives Kanpur to Lucknow and stops short of the stand; Suresh's bus
     * waits past it, takes the parcel from him and drives on to Gorakhpur. Returns both, and where the camera looks.
     */
    const buses = (k: Clock) => {
      const la = ROUTE.lucknowAt, stop = h * 0.2, arrived = k.pos >= la - 0.001;
      const a = k.beat === 0
        ? stands.KNP - stop - w * 0.55 + w * 0.55 * (1 - Math.pow(1 - Math.min(1, k.fill / 0.7), 3))
        : k.beat <= 2 ? stands.KNP - stop
        : k.beat === 3 ? stands.KNP - stop + (stands.LKO - stands.KNP) * Math.min(1, k.pos / la)
        : stands.LKO - stop;
      const bStart = stands.LKO + stop, bEnd = stands.GKP - stop;
      const b = k.beat === 4 ? bStart + (bEnd - bStart) * Math.max(0, (k.pos - la) / (1 - la)) : bStart;
      const look = k.beat <= 2 ? a : k.beat === 3 ? (arrived ? (a + b) / 2 : a) : b;
      return { a, b, look, arrived, aMoving: (k.beat === 0 && k.fill < 0.7) || (k.beat === 3 && !arrived), bMoving: k.beat === 4 && k.pos < 0.999 };
    };

    const figure = (x: number, y: number, s: number, color = "#0c0b08") => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y - s * 0.86, s * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 0.15, y); ctx.lineTo(x - s * 0.1, y - s * 0.7); ctx.lineTo(x + s * 0.1, y - s * 0.7); ctx.lineTo(x + s * 0.15, y); ctx.closePath(); ctx.fill();
    };
    const parcel = (x: number, y: number, s: number) => {
      ctx.fillStyle = "#ece5d3"; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.fillStyle = rgba(GOLD, 1); ctx.fillRect(x - s / 2, y - s * 0.08, s, s * 0.16);
    };
    const stand = (x: number, ground: number, name: string, lit: boolean) => {
      const s = h * 0.085;
      ctx.fillStyle = "#0c0b08";
      ctx.fillRect(x - s * 0.55, ground - s, s * 0.05, s); ctx.fillRect(x + s * 0.5, ground - s, s * 0.05, s);
      ctx.beginPath(); ctx.moveTo(x - s * 0.75, ground - s); ctx.lineTo(x + s * 0.75, ground - s * 1.12); ctx.lineTo(x + s * 0.75, ground - s * 1.02); ctx.lineTo(x - s * 0.75, ground - s * 0.92); ctx.closePath(); ctx.fill();
      const lamp = ctx.createRadialGradient(x, ground - s * 0.9, 0, x, ground - s * 0.9, s * (lit ? 1.6 : 0.9));
      lamp.addColorStop(0, rgba(GOLD, lit ? 0.55 : 0.25)); lamp.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = lamp; ctx.fillRect(x - s * 2, ground - s * 2.6, s * 4, s * 2.8);
      ctx.fillStyle = rgba(GOLD, 0.95); ctx.beginPath(); ctx.arc(x, ground - s * 0.9, s * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(236,229,211,${lit ? 0.85 : 0.5})`; ctx.font = `500 ${Math.max(16, h * 0.03)}px ${serif}`; ctx.textAlign = "center";
      ctx.fillText(name, x, ground - s * 1.35);
    };
    const bus = (x: number, ground: number, moving: boolean, t: number, driver: string) => {
      const L = h * 0.17, H = h * 0.06, y = ground - H - h * 0.01;
      if (moving) { // headlights reaching ahead
        const beam = ctx.createLinearGradient(x + L / 2, 0, x + L / 2 + h * 0.45, 0);
        beam.addColorStop(0, rgba(GOLD, 0.28)); beam.addColorStop(1, rgba(GOLD, 0));
        ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x + L / 2, y + H * 0.62); ctx.lineTo(x + L / 2 + h * 0.45, y + H * 0.35); ctx.lineTo(x + L / 2 + h * 0.45, y + H * 1.05); ctx.lineTo(x + L / 2, y + H * 0.82); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#0b0a08"; ctx.beginPath(); ctx.roundRect(x - L / 2, y, L, H, H * 0.18); ctx.fill();
      ctx.fillRect(x - L * 0.36, y - H * 0.16, L * 0.6, H * 0.16); // roof rack
      parcel(x - L * 0.22, y - H * 0.26, H * 0.2); parcel(x - L * 0.02, y - H * 0.26, H * 0.2);
      for (let i = 0; i < 7; i++) { // lit windows
        ctx.fillStyle = rgba(GOLD, 0.42 + 0.06 * Math.sin(t / 700 + i));
        ctx.fillRect(x - L * 0.44 + i * L * 0.118, y + H * 0.16, L * 0.09, H * 0.34);
      }
      ctx.fillStyle = rgba(GOLD, 0.9); ctx.fillRect(x + L / 2 - H * 0.08, y + H * 0.62, H * 0.08, H * 0.12);
      ctx.fillStyle = "#050504";
      [-0.3, 0.3].forEach((k) => { ctx.beginPath(); ctx.arc(x + k * L, y + H, H * 0.2, 0, Math.PI * 2); ctx.fill(); });
      // Whose bus it is, above the roof.
      ctx.fillStyle = "rgba(236,229,211,0.7)"; ctx.font = `600 ${Math.max(11, h * 0.017)}px var(--font-mulish), system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillText(driver, x, y - H * 0.5);
    };
    const ring = (x: number, y: number, k: number) => {
      for (let i = 0; i < 3; i++) {
        const p = (k * 1.5 - i * 0.25); if (p <= 0 || p >= 1) continue;
        ctx.strokeStyle = rgba(GOLD, (1 - p) * 0.9); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, h * 0.02 + p * h * 0.16, 0, Math.PI * 2); ctx.stroke();
      }
    };

    const frame = (now: number) => {
      raf = 0;
      const k = clock.current ?? { beat: 4, pos: 1, fill: 1 };
      const dt = Math.min(64, now - (lastT || now)); lastT = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ground = h * GROUND;
      const B = buses(k);
      const target = Math.max(0, Math.min(worldW - w, B.look - w * 0.6));
      // The camera holds the bus in frame, easing a little; when the day starts again it cuts back to Kanpur.
      if (k.beat === 0 && lastBeat === 4) first = true;
      camX = reduce || first ? target : camX + (target - camX) * Math.min(1, dt / 90);
      first = false;

      // Sky: ink above, warming towards the horizon, with the low sun.
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, "#15130f"); sky.addColorStop(0.5, "#2a2218"); sky.addColorStop(1, "#7a5f38");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const sx = w * 0.76 - camX * 0.015, sy = h * 0.36, sr = Math.min(w, h) * 0.085;
      const glow = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 5);
      glow.addColorStop(0, rgba(GOLD, 0.35)); glow.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgba(GOLD, 0.95); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // The hills, far to near, each slid by its own depth.
      layers.forEach((c, i) => {
        ctx.drawImage(c, -camX * LAYERS[i].p, 0, c.width / dpr, h);
        // A band of haze at the foot of each layer, so the next one stands out in front of it.
        const fy = h * LAYERS[i].base, haze = ctx.createLinearGradient(0, fy - h * 0.06, 0, fy + h * 0.02);
        haze.addColorStop(0, rgba(GOLD, 0)); haze.addColorStop(1, rgba([150, 118, 72], 0.16 - i * 0.025));
        ctx.fillStyle = haze; ctx.fillRect(0, fy - h * 0.06, w, h * 0.08);
      });

      // Electric poles along the road, passing faster than the hills, with the wire sagging between them.
      {
        const gap = Math.max(160, w * 0.16), pp = 0.85, off = (camX * pp) % gap, ph = h * 0.15;
        ctx.strokeStyle = "rgba(10,9,7,0.9)"; ctx.lineWidth = 2;
        for (let x = -off - gap; x < w + gap; x += gap) {
          const top = ground - ph;
          ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x, top); ctx.moveTo(x - ph * 0.12, top + 6); ctx.lineTo(x + ph * 0.12, top + 6); ctx.stroke();
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, top + 6); ctx.quadraticCurveTo(x + gap / 2, top + 6 + ph * 0.16, x + gap, top + 6); ctx.stroke(); ctx.lineWidth = 2;
        }
      }

      // The ground and the road on it.
      ctx.fillStyle = "#17150f"; ctx.fillRect(0, ground - h * 0.01, w, h - ground + h * 0.01);
      ctx.strokeStyle = "rgba(236,229,211,0.12)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke();
      // Proven road turns gold behind the bus; on delivery the gold runs back the whole way.
      const goldTo = k.beat < 2 ? stands.KNP : k.beat === 3 ? B.a : B.b;
      ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(stands.KNP - camX, ground); ctx.lineTo(goldTo - camX, ground); ctx.stroke();
      if (k.beat === 4 && k.fill > 0.55) {
        const back = (k.fill - 0.55) / 0.45, from = stands.GKP - (stands.GKP - stands.KNP) * back;
        const sweep = ctx.createLinearGradient(from - camX - 200, 0, from - camX + 60, 0);
        sweep.addColorStop(0, rgba(GOLD, 0)); sweep.addColorStop(1, rgba(GOLD, 0.8));
        ctx.strokeStyle = sweep; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(from - camX - 200, ground); ctx.lineTo(from - camX + 60, ground); ctx.stroke();
      }

      // Stands, the shop at Kanpur and the receiver at Gorakhpur, and the parcel's way between them.
      const s = h * 0.075;
      (["KNP", "LKO", "GKP"] as const).forEach((id, i) => {
        const x = stands[id] - camX;
        if (x < -w * 0.3 || x > w * 1.3) return;
        const reached = (id === "KNP" && k.beat >= 1) || (id === "LKO" && k.beat >= 3 && B.arrived) || (id === "GKP" && k.beat >= 4 && k.pos >= 0.999);
        stand(x, ground, ["Kanpur", "Lucknow", "Gorakhpur"][i], reached);
        if (id !== "LKO") figure(x - s * 0.9, ground, s);
      });
      const aX = B.a - camX, bX = B.b - camX, busTop = ground - h * 0.09, door = h * 0.05;
      const handTo = (fromX: number, toX: number, p: number) => {
        const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
        parcel(fromX + (toX - fromX) * e, busTop - Math.sin(e * Math.PI) * h * 0.06, h * 0.03);
      };
      const atStand = (id: "KNP" | "GKP") => stands[id] - camX - s * 0.9;
      if (k.beat === 0) parcel(atStand("KNP") + s * 0.25, ground - s * 0.5, h * 0.03);
      if (k.beat === 1) handTo(atStand("KNP") + s * 0.25, aX + door, (k.fill - 0.2) / 0.6);
      if (k.beat === 2) { parcel(aX + door, busTop, h * 0.03); ring(aX + door, busTop, k.fill); }
      // Lucknow: Ramesh hands it across to Suresh's bus, driver to driver.
      if (k.beat === 3 && B.arrived) handTo(aX + door, bX - door, (k.fill - 0.5) / 0.4);
      if (k.beat === 4 && k.pos >= 0.999) handTo(bX + door, atStand("GKP") + s * 0.25, (k.fill - 0.5) / 0.3);

      if (aX > -w * 0.3 && aX < w * 1.3) bus(aX, ground, B.aMoving, now, "Ramesh");
      if (bX > -w * 0.3 && bX < w * 1.3) bus(bX, ground, B.bMoving, now, "Suresh");

      // Gold rising where a driver is paid (Lucknow) and where the held pay releases (Gorakhpur).
      if (k.beat !== lastBeat) {
        if (k.beat === 3) for (let i = 0; i < 26; i++) rising.push({ x: stands.LKO + (Math.random() - 0.5) * h * 0.2, y: ground - h * 0.05, vy: 0.4 + Math.random() * 0.8, life: 0 });
        if (k.beat === 4) for (let i = 0; i < 40; i++) rising.push({ x: stands.KNP + Math.random() * (stands.GKP - stands.KNP), y: ground, vy: 0.3 + Math.random() * 0.7, life: -Math.random() * 1.5 });
        lastBeat = k.beat;
      }
      for (let i = rising.length - 1; i >= 0; i--) {
        const m = rising[i]; m.life += dt / 1000;
        if (m.life > 2.6) { rising.splice(i, 1); continue; }
        if (m.life < 0) continue;
        m.y -= m.vy * dt * 0.06;
        ctx.fillStyle = rgba(GOLD, Math.max(0, 1 - m.life / 2.6)); ctx.fillRect(m.x - camX, m.y, 2.4, 2.4);
      }

      // Dust in the low sun, near motes larger and faster.
      motes.forEach((m) => {
        if (!reduce) { m.x += (0.00002 + m.z * 0.00005) * dt; m.y -= 0.000008 * dt * m.z; if (m.x > 1.05) m.x = -0.05; if (m.y < -0.05) m.y = 1.05; }
        const x = ((m.x * w - camX * m.z * 0.15) % w + w) % w, y = m.y * h * 0.9;
        ctx.fillStyle = m.gold ? rgba(GOLD, 0.5 * m.z) : `rgba(236,229,211,${0.08 + 0.22 * m.z * m.s})`;
        ctx.fillRect(x, y, 1 + m.z * 1.6, 1 + m.z * 1.6);
      });

      // Grass in front, swaying, slid faster than the road.
      ctx.fillStyle = "#0a0907";
      const gTop = h * 0.93;
      ctx.fillRect(0, h * 0.985, w, h);
      blades.forEach((b) => {
        const x = ((b.x * w * 1.6 - camX * 1.2) % (w * 1.6) + w * 1.6) % (w * 1.6) - w * 0.3;
        const sway = reduce ? 0 : Math.sin(now / 1400 + b.ph) * 6;
        ctx.beginPath(); ctx.moveTo(x - 3, h); ctx.quadraticCurveTo(x + b.lean * 20, gTop + (h - gTop) * (1 - b.hgt) * 0.6, x + b.lean * 30 + sway, gTop + (h - gTop) * (1 - b.hgt)); ctx.lineTo(x + 3, h); ctx.fill();
      });

      // Vignette.
      const v = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

      if (visible && !reduce) raf = requestAnimationFrame(frame);
    };

    build();
    const ro = new ResizeObserver(() => { build(); first = true; if (!raf) raf = requestAnimationFrame(frame); });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); });
    io.observe(cv);
    const onVis = () => { visible = document.visibilityState === "visible"; if (visible && !raf) raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [clock]);

  return <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />;
}

/** A still description of the film, for anyone who cannot see it. */
export const FILM_ALT = "A drawn film: a state bus at dawn drives the road from Kanpur to Lucknow to Gorakhpur; at each stand the parcel is handed over and gold light marks the proof and the pay.";
export const FILM_INK = INK;
