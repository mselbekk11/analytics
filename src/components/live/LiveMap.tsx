"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { visitorPath } from "@/components/customers/Customers";
import { displayName, persona } from "@/lib/names";
import type { LiveData } from "./Live";

// Free vector tiles, no key needed (https://openfreemap.org): positron on the light theme
const styleUrl = (theme: string | undefined) =>
  `https://tiles.openfreemap.org/styles/${theme === "light" ? "positron" : "dark"}`;
// MapLibre's web worker, copied into public/ by `npm run build:map-worker`: the bundler
// doesn't emit the file maplibre-gl looks for next to itself
const WORKER_URL = "/maplibre-gl-worker.js";
// Visitors in the same ~10 km cell (positions are rounded to 1 decimal) are spread on a
// small circle so each dot can be clicked
const SPREAD_DEG = 0.03;

type Visitor = LiveData["visitors"][number];
type Placed = Visitor & { lat: number; lon: number };

/** A MapLibre map with one dot per visitor online now; a dot opens the visitor's profile. */
export default function LiveMap({ domain, visitors }: { domain: string; visitors: Visitor[] }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const style = styleUrl(resolvedTheme);
  // The style the map was created with or last switched to
  const styleRef = useRef(style);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // maplibre-gl touches `window`, so it is loaded in the browser only
  useEffect(() => {
    let cancelled = false;
    const placed = markers.current;
    import("maplibre-gl")
      .then(({ Map, setWorkerUrl }) => {
        if (cancelled || container.current === null) return;
        setWorkerUrl(WORKER_URL);
        map.current = new Map({
          container: container.current,
          style: styleRef.current,
          center: [0, 20],
          zoom: 0.8,
          attributionControl: { compact: true },
        });
        // Dots are DOM markers, so they can go on before the tiles have loaded
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      placed.forEach((m) => m.remove());
      placed.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Dots are DOM markers, so they stay put when the style changes
  useEffect(() => {
    const m = map.current;
    if (!ready || m === null || styleRef.current === style) return;
    styleRef.current = style;
    m.setStyle(style);
  }, [ready, style]);

  useEffect(() => {
    const m = map.current;
    if (!ready || m === null) return;
    let cancelled = false;
    void import("maplibre-gl").then(({ Marker, LngLatBounds }) => {
      if (cancelled) return;
      const shown = spread(visitors.filter((v): v is Placed => v.lat !== null && v.lon !== null));
      const keep = new Set(shown.map((v) => v.visitorId));
      for (const [id, marker] of markers.current) {
        if (!keep.has(id)) {
          marker.remove();
          markers.current.delete(id);
        }
      }
      for (const v of shown) {
        const existing = markers.current.get(v.visitorId);
        if (existing !== undefined) {
          existing.setLngLat([v.lon, v.lat]);
          dot(existing.getElement(), v);
          continue;
        }
        const el = document.createElement("button");
        el.type = "button";
        el.addEventListener("click", () => router.push(visitorPath(domain, v.visitorId)));
        dot(el, v);
        markers.current.set(v.visitorId, new Marker({ element: el }).setLngLat([v.lon, v.lat]).addTo(m));
      }
      // Zoom to the first visitors once; after that the view stays where the owner put it
      if (!fitted.current && shown.length > 0) {
        fitted.current = true;
        const bounds = new LngLatBounds();
        for (const v of shown) bounds.extend([v.lon, v.lat]);
        m.fitBounds(bounds, { padding: 60, maxZoom: 6, duration: 0 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, visitors, domain, router]);

  if (failed) {
    return <p className="p-4 text-sm text-muted-foreground">The map could not load.</p>;
  }
  return <div ref={container} className="size-full" />;
}

/** The visitor's avatar on its colour, with their name and page as the tooltip. */
function dot(el: HTMLElement, v: Visitor) {
  const p = persona(v.visitorId);
  const place = [v.city, v.country].filter(Boolean).join(", ");
  el.title = `${displayName(v.visitorId, v.name, v.email)}\n${place}\n${v.source} · ${v.path}`;
  el.setAttribute("aria-label", displayName(v.visitorId, v.name, v.email));
  el.textContent = p.emoji;
  el.className =
    "flex size-8 cursor-pointer items-center justify-center rounded-full text-lg shadow-lg ring-2 ring-white/80 transition-transform hover:scale-110";
  el.style.backgroundColor = p.color;
}

/** Moves visitors who share a rounded position onto a small circle around it. */
function spread(visitors: Placed[]): Placed[] {
  const groups = new Map<string, Placed[]>();
  for (const v of visitors) {
    const key = `${v.lat},${v.lon}`;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  return [...groups.values()].flatMap((group) =>
    group.length === 1
      ? group
      : group
          .sort((a, b) => (a.visitorId < b.visitorId ? -1 : 1)) // a stable place on the circle
          .map((v, i) => {
            const angle = (2 * Math.PI * i) / group.length;
            return { ...v, lat: v.lat + SPREAD_DEG * Math.sin(angle), lon: v.lon + SPREAD_DEG * Math.cos(angle) };
          }),
  );
}
