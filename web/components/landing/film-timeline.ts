/**
 * The hero film's timeline: the same ten shots as video/hero/film.tsx (rendered by raea), with the words the site
 * lays over them. The film is pure picture; these captions, the partner that does each step and the five chapters
 * of the stepper follow the video's own clock. Every number is KNP-1204's public record.
 */
export type Shot = { t0: number; t1: number; place: string; title: string; body: string; tech?: string; logo?: "hedera" | "0g" | "arkiv" | "swarm" };

export const FILM_SECONDS = 60;

export const SHOTS: Shot[] = [
  { t0: 0, t1: 5, place: "Kanpur, 7:04 am", title: "A box of garments for Gorakhpur", body: "Gupta Garments books KNP-1204: 359 km on two buses." },
  { t0: 5, t1: 10, place: "Kanpur", title: "The shop's agent pays. Nobody approves it", body: "₹206.64 in dINR over x402: the meter plus Daak's fee.", tech: "Hedera x402, HTS", logo: "hedera" },
  { t0: 10, t1: 15, place: "Kanpur stand, 9:00", title: "Ramesh's bus pulls in", body: "He took the job in the app: 87 km, ₹44.71.", tech: "Arkiv records", logo: "arkiv" },
  { t0: 15, t1: 21, place: "Kanpur stand", title: "Sticker, badge, lid photo", body: "Ramesh's phone signs the handoff. The photo is stored encrypted.", tech: "Android Keystore, Swarm", logo: "swarm" },
  { t0: 21, t1: 28, place: "Inside a sealed machine", title: "0G reads the lid", body: "Right code, still sealed. Then it goes on the public log.", tech: "0G compute in a TEE, Hedera HCS", logo: "0g" },
  { t0: 28, t1: 35, place: "On the road, 87 km", title: "Every kilometre on the meter", body: "₹5 plus 50 paise a km, the same rate for every shop." },
  { t0: 35, t1: 41, place: "Lucknow, Charbagh", title: "Ramesh hands it to Suresh", body: "The moment Suresh confirms, Ramesh is paid ₹22.35. The rest waits.", tech: "Hedera token transfer", logo: "hedera" },
  { t0: 41, t1: 48, place: "On to Gorakhpur, 272 km", title: "Suresh carries it on", body: "A second bus, a second driver, the same record." },
  { t0: 48, t1: 53, place: "Ghosh Cloth House, Gorakhpur", title: "Delivered", body: "The receiver confirms. Suresh is paid ₹69.89 at once.", tech: "Hedera token transfer", logo: "hedera" },
  { t0: 53, t1: 60, place: "11:44 am", title: "The held pay releases itself", body: "₹92.26, a scheduled transaction on Hedera. No server sent it.", tech: "Hedera scheduled transaction", logo: "hedera" },
];

/** The stepper's five chapters, each a run of shots. */
export const CHAPTERS = [
  { label: "Book", t0: 0, t1: 10 },
  { label: "Hand over", t0: 10, t1: 21 },
  { label: "Check", t0: 21, t1: 28 },
  { label: "Pay", t0: 28, t1: 41 },
  { label: "Deliver", t0: 41, t1: 60 },
];

export const shotAt = (t: number) => SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];
export const chapterAt = (t: number) => Math.max(0, CHAPTERS.findIndex((c) => t >= c.t0 && t < c.t1));
