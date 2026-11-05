"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SiteNav } from "@/components/site-nav";

type Data = {
  source: { postOffices: string; busStations: string };
  counts: { ho: number; so: number; bo: number; bus: number; points: number; states: number };
  po: [number, number, 0 | 1 | 2][];
  ho: [number, number, string, string][];
  bus: [number, number, string, string][];
  /** Driving routes along the roads for each Daak stretch, from OSRM, keyed by leg id. */
  roads?: Record<string, { km: number; coords: [number, number][] }>;
};
type Net = { stops: { id: string; name: string; at?: [number, number] }[]; legs: { id: string; from: string; to: string; km: number }[] };
type Layer = "post" | "bus" | "daak";

const T = { ink: "#1f2a44", muted: "#6b6f7a", rule: "#e2dbcb", ok: "#2e7d4f", wait: "#b7791f", paper: "#f7f3ea" };
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const pt = (lat: number, lng: number, props: Record<string, unknown>): GeoJSON.Feature => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: props });

/**
 * The network Daak rides on, already built: India Post's office tree across India, the bus stations
 * between them, and Daak's live corridors on top. Every point comes from a public dataset named below the map.
 */
export default function NetworkMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [net, setNet] = useState<Net | null>(null);
  const [show, setShow] = useState<Record<Layer, boolean>>({ post: true, bus: true, daak: true });

  useEffect(() => {
    fetch("/map/india.json").then((r) => r.json()).then(setData);
    fetch("/api/network").then((r) => r.json()).then(setNet);
  }, []);

  useEffect(() => {
    if (!box.current || !data || !net || map.current) return;
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return;
      const m = new maplibregl.Map({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        // Opens on North India, Punjab to Bihar, with the live corridor in the middle; the whole country is there to pan to.
        bounds: [[73.5, 23.0], [88.5, 32.0]],
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        const stop = new Map(net.stops.map((s) => [s.id, s]));
        m.addSource("po", { type: "geojson", data: fc(data.po.map(([la, lo, t]) => pt(la, lo, { t }))) });
        m.addLayer({ id: "post-bo", type: "circle", source: "po", filter: ["==", ["get", "t"], 2], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, 3], "circle-color": T.muted, "circle-opacity": 0.45 } });
        m.addLayer({ id: "post-so", type: "circle", source: "po", filter: ["==", ["get", "t"], 1], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.6, 10, 5], "circle-color": T.ink, "circle-opacity": 0.6 } });
        m.addSource("ho", { type: "geojson", data: fc(data.ho.map(([la, lo, name, district]) => pt(la, lo, { name, district }))) });
        m.addLayer({ id: "post-ho", type: "circle", source: "ho", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3.5, 10, 8], "circle-color": T.paper, "circle-stroke-color": T.ink, "circle-stroke-width": 2 } });
        m.addSource("bus", { type: "geojson", data: fc(data.bus.map(([la, lo, name, op]) => pt(la, lo, { name, op }))) });
        m.addLayer({ id: "bus", type: "circle", source: "bus", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 7], "circle-color": T.wait, "circle-stroke-color": T.paper, "circle-stroke-width": 1 } });
        const lines = net.legs.flatMap((l) => {
          const a = stop.get(l.from)?.at, b = stop.get(l.to)?.at;
          const road = data.roads?.[l.id]?.coords;
          const coordinates = road ?? (a && b ? [[a[1], a[0]], [b[1], b[0]]] : null);
          return coordinates ? [{ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates }, properties: { km: l.km } }] : [];
        });
        m.addSource("daak", { type: "geojson", data: fc([...lines, ...net.stops.filter((s) => s.at).map((s) => pt(s.at![0], s.at![1], { name: s.name.split(",")[0] }))]) });
        m.addLayer({ id: "daak-line", type: "line", source: "daak", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": T.ok, "line-width": 4 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addLayer({ id: "daak-stop", type: "circle", source: "daak", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 8, "circle-color": T.ok, "circle-stroke-color": T.paper, "circle-stroke-width": 2 } });
        m.addLayer({ id: "daak-label", type: "symbol", source: "daak", filter: ["==", ["geometry-type"], "Point"], layout: { "text-field": ["get", "name"], "text-offset": [0, 1.3], "text-size": 13, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": T.ok, "text-halo-color": T.paper, "text-halo-width": 2 } });
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 8 });
        const tip = (layer: string, html: (p: Record<string, string>) => string) => {
          m.on("click", layer, (e) => { const p = e.features?.[0]?.properties as Record<string, string>; if (p) popup.setLngLat(e.lngLat).setHTML(html(p)).addTo(m); });
          m.on("mouseenter", layer, () => { m.getCanvas().style.cursor = "pointer"; });
          m.on("mouseleave", layer, () => { m.getCanvas().style.cursor = ""; });
        };
        tip("post-ho", (p) => `<b>${p.name}</b><br/>Head post office, ${p.district}`);
        tip("bus", (p) => `<b>${p.name}</b>${p.op ? `<br/>${p.op}` : ""}<br/>Bus station`);
        tip("daak-stop", (p) => `<b>${p.name}</b><br/>Daak stop`);
      });
    });
    return () => { cancelled = true; };
  }, [data, net]);

  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;
    const set = (ids: string[], on: boolean) => ids.forEach((id) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    set(["post-bo", "post-so", "post-ho"], show.post);
    set(["bus"], show.bus);
    set(["daak-line", "daak-stop", "daak-label"], show.daak);
  }, [show]);

  const total = data ? data.counts.ho + data.counts.so + data.counts.bo : 0;
  const key = (layer: Layer, label: string, swatch: string) => (
    <button
      key={layer}
      onClick={() => setShow((s) => ({ ...s, [layer]: !s[layer] }))}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-transform active:scale-[0.97] ${show[layer] ? "bg-card-paper text-ink shadow-sm" : "bg-rule/70 text-muted-ink"}`}
    >
      <span className="size-3 rounded-sm" style={{ background: swatch }} />
      {label}
    </button>
  );

  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <SiteNav />
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">The network is already built</h1>
        <p className="max-w-3xl text-muted-ink">
          India Post already runs a relay across the country, from head offices to sub offices to branch offices, and state buses link the towns between them.
          Daak puts a meter, a receipt and a payout on that network. It starts with one corridor in Uttar Pradesh and grows across North India.
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [data ? data.counts.ho.toLocaleString("en-IN") : "...", "head post offices"],
          [data ? (data.counts.so + data.counts.bo).toLocaleString("en-IN") : "...", "sub and branch offices"],
          [data ? data.counts.bus.toLocaleString("en-IN") : "...", "bus stations on OpenStreetMap"],
          [net ? `${net.legs.reduce((s, l) => s + l.km, 0)} km` : "...", "Daak corridor live"],
        ].map(([n, label]) => (
          <div key={label} className="rounded-xl border border-rule bg-card-paper p-3">
            <p className="text-2xl font-semibold">{n}</p>
            <p className="text-sm text-muted-ink">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {key("post", "Post offices", T.ink)}
        {key("bus", "Bus stations", T.wait)}
        {key("daak", "Daak corridor", T.ok)}
      </div>

      <div ref={box} className="h-[70vh] min-h-[360px] w-full overflow-hidden rounded-xl border border-rule bg-card-paper" />

      <section className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-rule bg-card-paper p-4">
          <h2 className="font-semibold">Where Daak goes next</h2>
          <p className="mt-1 text-muted-ink">
            Each new corridor joins two head-office towns that already have a bus station. Kanpur to Lucknow to Gorakhpur is live. The next ones follow the same pattern
            across North India: Gorakhpur to Patna, Lucknow to Delhi, Delhi to Jaipur and Chandigarh.
          </p>
        </div>
        <div className="rounded-xl border border-rule bg-card-paper p-4">
          <h2 className="font-semibold">Where the data comes from</h2>
          <p className="mt-1 text-muted-ink">
            {data ? `${total.toLocaleString("en-IN")} offices in ${data.counts.states} states and union territories with usable coordinates, from the ${data.source.postOffices}. Offices sharing a location are drawn once (${data.counts.points.toLocaleString("en-IN")} points). ` : ""}
            Bus stations: {data?.source.busStations ?? "OpenStreetMap"}. The corridor follows the driving route on OpenStreetMap roads (OSRM). Basemap: OpenFreeMap, OpenStreetMap.
          </p>
        </div>
      </section>
    </main>
  );
}
