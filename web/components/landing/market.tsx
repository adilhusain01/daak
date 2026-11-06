/**
 * The market Daak taps, in the states' own numbers: what state buses already earn from parcels, and what Uttar Pradesh
 * has put on the table. Every figure is published by the transport corporation or reported from its statements, with
 * the link beside it. The one derived number (APSRTC's daily revenue over a year) says it is arithmetic.
 */
type Bar = { who: string; state: string; crore: number; shown: string; note: string; href: string; source: string };

const BARS: Bar[] = [
  { who: "APSRTC", state: "Andhra Pradesh", crore: 219, shown: "~₹219 crore", note: "₹60 lakh and 31,000 parcels a day (Dec 2024); a year at that rate is about ₹219 crore.", href: "https://www.thehansindia.com/news/cities/visakhapatnam/apsrtc-achieves-70-of-its-parcel-target-931532", source: "The Hans India" },
  { who: "TSRTC Logistics", state: "Telangana", crore: 90, shown: "₹90 crore", note: "In 2022. 79 lakh bookings in its first two years.", href: "https://telanganatoday.com/tsrtc-logistics-wing-earns-rs-90-crore-revenue-in-2022", source: "Telangana Today" },
  { who: "MSRTC", state: "Maharashtra", crore: 31.16, shown: "₹31 crore", note: "Goods carried on ST buses, 2022-23 (RTI reply).", href: "https://thehitavada.com/Encyc/2023/7/31/Goods-transport-MSRTC-suffers-drop-in-revenue-over-three-years.html", source: "The Hitavada" },
  { who: "UPSRTC", state: "Uttar Pradesh", crore: 3, shown: "₹3 crore floor", note: "The reserve price UP set for the parcel rights on all its buses (2022 tender).", href: "https://upsrtc.up.gov.in/site/writereaddata/UploadNews/pdf/C_202204071457502240.pdf", source: "UPSRTC tender" },
];
const MAX = Math.max(...BARS.map((b) => b.crore));

const UP: [string, string, string][] = [
  ["12,000+", "UPSRTC buses", "carrying about 60 crore passengers a year from 115 depots"],
  ["4,944 m³", "of parcel space", "UPSRTC itself allots across 11,310 buses, up to 150 kg on each ordinary bus"],
  ["1,47,032", "state transport buses in India", "on 58 corporations (2021-22); 617 lakh passengers a day before Covid"],
];

export function Market() {
  return (
    <div className="flex flex-col gap-16">
      <figure className="flex flex-col gap-1" aria-labelledby="market-chart">
        <figcaption id="market-chart" className="mb-4 text-soft-ink">What state buses already earn from parcels, a year</figcaption>
        <ol className="flex flex-col">
          {BARS.map((b) => (
            <li key={b.who} className="grid grid-cols-1 gap-x-8 gap-y-2 border-t border-rule py-5 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-3">
                <p className="font-display text-2xl font-semibold leading-tight">{b.state}</p>
                <p className="font-mono text-xs text-muted-ink">{b.who}</p>
              </div>
              <div className="flex items-center gap-4 lg:col-span-5">
                <div className="h-8 flex-1 bg-tray/70" role="img" aria-label={`${b.state}: ${b.shown}`}>
                  <div className={`h-full ${b.who === "UPSRTC" ? "bg-ink" : "bg-gold"}`} style={{ width: `${Math.max(1.2, (b.crore / MAX) * 100)}%` }} />
                </div>
                <p className="w-44 shrink-0 whitespace-nowrap font-display text-2xl font-medium tabular-nums">{b.shown}</p>
              </div>
              <p className="text-sm text-soft-ink lg:col-span-4">
                {b.note} <a href={b.href} target="_blank" rel="noreferrer" className="whitespace-nowrap font-semibold text-gold-deep underline decoration-rule decoration-2 underline-offset-4 hover:decoration-gold">{b.source}</a>
              </p>
            </li>
          ))}
        </ol>
        <p className="border-t border-rule pt-4 text-sm text-muted-ink">Andhra and Telangana show bus parcels are a real business. Uttar Pradesh runs the most buses and has priced the rights at a floor of ₹3 crore. That is the gap Daak starts in.</p>
      </figure>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
        {UP.map(([n, what, line], i) => (
          <div key={what}>
            <p className="font-display text-5xl font-medium tabular-nums leading-none sm:text-6xl">{n}</p>
            <p className="mt-3 font-semibold">{what}</p>
            <p className="mt-1 text-sm text-soft-ink">
              {line}.{" "}
              <a href={i < 2 ? "https://upsrtc.up.gov.in/site/writereaddata/UploadNews/pdf/C_202204071457502240.pdf" : "https://morth.nic.in/sites/default/files/Review%20of%20the%20performance%20of%20State%20Road%20Transport%20Undertakings%20for%202019-20%20to%202021-22.pdf"}
                target="_blank" rel="noreferrer" className="whitespace-nowrap font-semibold text-gold-deep underline decoration-rule decoration-2 underline-offset-4 hover:decoration-gold">{i < 2 ? "UPSRTC tender, 2022" : "MoRTH"}</a>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
