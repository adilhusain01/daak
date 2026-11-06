"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAPTERS, FILM_SECONDS, SHOTS, chapterAt, shotAt } from "@/components/landing/film-timeline";

/**
 * The hero's film (rendered by raea from video/hero/film.tsx) and the words over it. The video is the clock: the
 * caption, its partner and the five-part stepper all read its current time, and pressing a chapter seeks it.
 * A phone gets the lighter copy. With reduced motion the film does not play; the last shot holds as a still.
 */
const LOGO: Record<string, { src: string; w: number; text?: string }> = {
  hedera: { src: "/logos/hedera.svg", w: 14, text: "Hedera" },
  "0g": { src: "/logos/0g.svg", w: 26 },
  arkiv: { src: "/logos/arkiv.svg", w: 52 },
  swarm: { src: "/logos/swarm.svg", w: 50 },
};

export function useFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const v = video.current; if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    v.src = window.innerWidth < 768 ? "/film/daak-hero-phone.mp4" : "/film/daak-hero-wide.mp4";
    if (reduce) { setStill(true); setPlaying(false); setT(SHOTS[SHOTS.length - 1].t0 + 1); return; }
    // The key shows what the video is actually doing.
    const on = () => setPlaying(true), off = () => setPlaying(false);
    v.addEventListener("play", on); v.addEventListener("pause", off);
    v.play().catch(() => setPlaying(false));
    let raf = 0;
    const tick = () => { setT(v.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); v.removeEventListener("play", on); v.removeEventListener("pause", off); };
  }, []);

  const seek = useCallback((s: number) => {
    const v = video.current; if (!v) return;
    v.currentTime = s; setT(s);
    if (!still) v.play().catch(() => null);
  }, [still]);
  const toggle = useCallback(() => {
    const v = video.current; if (!v) return;
    if (v.paused) v.play().catch(() => null); else v.pause();
  }, []);
  return { video, t, playing, still, seek, toggle };
}

export type Film = ReturnType<typeof useFilm>;

export function HeroVideo({ film }: { film: Film }) {
  return (
    <video ref={film.video} muted loop playsInline preload="auto" poster="/film/daak-hero-poster.jpg" aria-hidden
      className="absolute inset-0 size-full object-cover object-[62%_50%]" />
  );
}

export function FilmCaption({ film }: { film: Film }) {
  const s = shotAt(film.t);
  const logo = s.logo ? LOGO[s.logo] : null;
  return (
    <div aria-live="polite" className="max-w-2xl">
      <p className="text-sm text-lamp">{s.place}</p>
      <p key={s.t0} className="mt-1 font-display text-3xl font-medium leading-tight text-paper motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 sm:text-4xl">{s.title}</p>
      <p className="mt-2 text-paper/70">{s.body}</p>
      {s.tech && (
        <p className="mt-3 flex items-center gap-2 font-mono text-xs text-paper/55">
          {logo && <span className="flex items-center gap-1 rounded-[4px] bg-paper px-1.5 py-1"><img src={logo.src} alt="" style={{ width: logo.w }} className="h-auto" />{logo.text && <span className="font-sans text-[11px] font-bold text-ink">{logo.text}</span>}</span>}
          {s.tech}
        </p>
      )}
    </div>
  );
}

/** Five chapters, each a label over a thin bar that fills as the film plays through it; press one to go there. */
export function FilmSteps({ film }: { film: Film }) {
  const now = chapterAt(film.t);
  return (
    <div className="flex items-end gap-3">
      <div className="grid flex-1 grid-cols-5 gap-2" role="group" aria-label="Chapters of KNP-1204's day">
        {CHAPTERS.map((c, i) => {
          const fill = i < now ? 1 : i > now ? 0 : Math.min(1, Math.max(0, (film.t - c.t0) / (c.t1 - c.t0)));
          return (
            <button key={c.label} onClick={() => film.seek(c.t0)} aria-pressed={now === i}
              className={`flex flex-col gap-2 pt-2 text-left text-xs font-semibold transition-colors sm:text-sm ${now === i ? "text-paper" : "text-paper/50 hover:text-paper/80"}`}>
              <span className="truncate">{c.label}</span>
              <span className="h-0.5 w-full overflow-hidden bg-paper/15"><span className="block h-full bg-lamp" style={{ width: `${fill * 100}%` }} /></span>
            </button>
          );
        })}
      </div>
      {!film.still && (
        <button onClick={film.toggle} aria-label={film.playing ? "Pause the film" : "Play the film"}
          className="grid size-9 shrink-0 place-items-center rounded-md text-paper/70 shadow-[inset_0_0_0_1px_rgb(236_229_211_/_0.25)] transition-transform hover:text-paper active:scale-95">
          {film.playing
            ? <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
            : <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden><path d="M4 2.5v11l9-5.5z" /></svg>}
        </button>
      )}
    </div>
  );
}

export const FILM_ALT = `A film drawn in cut paper, ${FILM_SECONDS} seconds: at dawn the shop at Kanpur books and pays, Ramesh's bus takes the parcel, a sealed check rings gold, he hands it to Suresh's bus at Lucknow and is paid, Suresh delivers at Gorakhpur, and gold runs back along the road as the held pay releases.`;
