"use client";

import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type LngLat = [number, number];
export type RouteMapData = {
  legs: { hop: number; coords: LngLat[]; stop: LngLat; done: boolean; etaAt: number | null }[];
  parcel: { at: LngLat; kind: "waiting" | "moving" | "arrived"; hop: number };
};

const T = { ink: "#1f2a44", ok: "#2e7d4f", wait: "#b7791f", paper: "#f7f3ea", rule: "#e2dbcb" };
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

/** One parcel's route along the road: done stretches solid green, the rest dashed, stops, and the parcel. */
export function RouteMap({ data }: { data: RouteMapData }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  useEffect(() => {
    if (!box.current || map.current) return;
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return;
      const all = data.legs.flatMap((l) => (l.coords.length ? l.coords : [l.stop]));
      const lngs = all.map((p) => p[0]), lats = all.map((p) => p[1]);
      const m = new maplibregl.Map({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        fitBoundsOptions: { padding: 36 },
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.current = m;
      m.on("load", () => {
        const line = (done: boolean) => fc(data.legs.filter((l) => l.done === done && l.coords.length).map((l) => ({ type: "Feature", geometry: { type: "LineString", coordinates: l.coords }, properties: {} })));
        m.addSource("done", { type: "geojson", data: line(true) });
        m.addSource("todo", { type: "geojson", data: line(false) });
        m.addLayer({ id: "todo", type: "line", source: "todo", paint: { "line-color": T.ink, "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.6 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addLayer({ id: "done", type: "line", source: "done", paint: { "line-color": T.ok, "line-width": 5 }, layout: { "line-cap": "round", "line-join": "round" } });
        m.addSource("stops", { type: "geojson", data: fc(data.legs.map((l) => ({ type: "Feature", geometry: { type: "Point", coordinates: l.stop }, properties: { done: l.done } }))) });
        m.addLayer({ id: "stops", type: "circle", source: "stops", paint: { "circle-radius": 6, "circle-color": ["case", ["get", "done"], T.ok, T.paper], "circle-stroke-color": ["case", ["get", "done"], T.ok, T.ink], "circle-stroke-width": 2 } });
        m.addSource("parcel", { type: "geojson", data: fc([{ type: "Feature", geometry: { type: "Point", coordinates: data.parcel.at }, properties: {} }]) });
        m.addLayer({ id: "parcel-halo", type: "circle", source: "parcel", paint: { "circle-radius": 14, "circle-color": data.parcel.kind === "arrived" ? T.ok : T.wait, "circle-opacity": 0.2 } });
        m.addLayer({ id: "parcel", type: "circle", source: "parcel", paint: { "circle-radius": 7, "circle-color": data.parcel.kind === "arrived" ? T.ok : T.wait, "circle-stroke-color": T.paper, "circle-stroke-width": 2 } });
      });
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, [data]);
  const note = data.parcel.kind === "moving" ? "Parcel position estimated from the bus time" : data.parcel.kind === "arrived" ? "Delivered" : "Waiting at the stand for the next bus";
  return (
    <div className="overflow-hidden rounded-2xl border border-rule bg-card-paper">
      <div ref={box} className="h-64 w-full sm:h-80" />
      <p className="flex items-center gap-2 border-t border-rule px-4 py-2 text-xs text-muted-ink">
        <span className={`size-2.5 rounded-sm ${data.parcel.kind === "arrived" ? "bg-ok" : "bg-wait"}`} /> {note} · road route from OpenStreetMap
      </p>
    </div>
  );
}
