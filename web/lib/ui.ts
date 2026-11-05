/** Shared display helpers for the dashboard and the tracking page. */
export type HandoffView = {
  key: string; hop: number; verdict: string; place: string; at: number; zgRequestId: string;
  hcs: string; reason: string; geo?: string;
};
export type LegView = { hop: number; place: string; km?: number | null };

export const verdictText: Record<string, { en: string; hi: string; tone: string }> = {
  green: { en: "Checked and handed over", hi: "जाँच हुई, सौंपा गया", tone: "text-ok" },
  held: { en: "Payment held", hi: "भुगतान रोका गया", tone: "text-held" },
  unchecked: { en: "Handed over, waiting for the AI check or a review", hi: "सौंपा गया, जाँच बाकी", tone: "text-wait" },
};

export const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const hashscanTopic = (hcs: string) => {
  const [topic, seq] = hcs.split("#");
  return `https://hashscan.io/testnet/topic/${topic}${seq ? `?sequence=${seq}` : ""}`;
};
export const arkivEntity = (key: string) => `https://rabdi.explorer.arkiv.network/entity/${key}`;
