"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Labels = {
  search_placeholder: string;
  picked: string;
  clear: string;
  hint: string;
  none: string;
};

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  onClear: () => void;
  labels: Labels;
};

const DEFAULT_CENTER: [number, number] = [21.0122, 52.2297]; // Warsaw
const DEFAULT_ZOOM = 5.2;
const PIN_ZOOM = 13;

// OSM raster tiles via the public, attribution-required endpoint.
// For production traffic switch to a tile provider (e.g. MapTiler, Stadia).
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export function CoachLocationPicker({
  lat,
  lng,
  onPick,
  onClear,
  labels,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: lat != null && lng != null ? [lng, lat] : DEFAULT_CENTER,
      zoom: lat != null && lng != null ? PIN_ZOOM : DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.on("click", (e) => {
      onPick(e.lngLat.lat, e.lngLat.lng);
    });
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker with lat/lng prop.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (lat != null && lng != null) {
      const el = document.createElement("div");
      el.className =
        "h-7 w-7 rounded-full bg-grass-500 ring-4 ring-white shadow-lg";
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(m);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onPick(ll.lat, ll.lng);
      });
      markerRef.current = marker;
    }
  }, [lat, lng, onPick]);

  async function geocode() {
    const q = search.trim();
    if (q.length < 3) return;
    setSearching(true);
    setSearchError(null);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("addressdetails", "0");
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length === 0) {
        setSearchError(labels.none);
        return;
      }
      const lat0 = Number(data[0].lat);
      const lng0 = Number(data[0].lon);
      onPick(lat0, lng0);
      mapRef.current?.flyTo({ center: [lng0, lat0], zoom: PIN_ZOOM });
    } catch {
      setSearchError(labels.none);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              geocode();
            }
          }}
          placeholder={labels.search_placeholder}
          className="h-10 flex-1 min-w-[200px] rounded-lg border border-ink-200 bg-white px-3 text-sm focus:border-grass-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={geocode}
          disabled={searching || search.trim().length < 3}
          className="inline-flex h-10 items-center rounded-lg bg-ink-700 px-3 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {searching ? "…" : "Go"}
        </button>
        {lat != null && lng != null && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
          >
            {labels.clear}
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-xl border border-ink-100"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span>{labels.hint}</span>
        {lat != null && lng != null ? (
          <span className="font-mono">
            {labels.picked}: {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        ) : null}
      </div>
      {searchError && <p className="text-xs text-clay-700">{searchError}</p>}
    </div>
  );
}
