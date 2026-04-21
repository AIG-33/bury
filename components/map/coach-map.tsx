"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type CoachPin = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  coach_avg_rating: number | null;
  coach_reviews_count: number;
  coach_hourly_rate_pln: number | null;
  lat: number;
  lng: number;
};

type Labels = {
  reviews_count: string;
  no_reviews: string;
  hourly_rate: string;
  view_profile: string;
};

const POLAND_CENTER: [number, number] = [19.4803, 52.0]; // Center of Poland
const FALLBACK_ZOOM = 5.6;

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

type Props = {
  locale: string;
  pins: CoachPin[];
  labels: Labels;
};

export function CoachMap({ locale, pins, labels }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: POLAND_CENTER,
      zoom: FALLBACK_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const m: MlMap = map;

    let removed = false;
    const markers: maplibregl.Marker[] = [];

    function drawAll() {
      if (removed) return;
      const bounds = new LngLatBounds();
      for (const p of pins) {
        const el = document.createElement("button");
        el.type = "button";
        el.className =
          "group relative h-9 w-9 -translate-y-2 cursor-pointer";
        el.innerHTML = `
          <span class="absolute inset-0 rounded-full bg-grass-500 ring-4 ring-white shadow-lg"></span>
          ${
            p.coach_avg_rating != null
              ? `<span class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ball-400 px-1 text-[10px] font-bold text-ink-900 shadow">${p.coach_avg_rating.toFixed(1)}</span>`
              : ""
          }
        `;

        const popupHtml = renderPopup(p, locale, labels);
        const popup = new maplibregl.Popup({
          offset: 16,
          maxWidth: "260px",
          closeButton: true,
        }).setHTML(popupHtml);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(popup)
          .addTo(m);
        markers.push(marker);
        bounds.extend([p.lng, p.lat]);
      }
      if (pins.length > 0) {
        try {
          m.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 600 });
        } catch {
          // ignore single-point bounds errors
        }
      }
    }

    if (m.loaded()) drawAll();
    else m.once("load", drawAll);

    return () => {
      removed = true;
      for (const m of markers) m.remove();
    };
  }, [pins, locale, labels]);

  return <div ref={containerRef} className="h-[520px] w-full" />;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPopup(p: CoachPin, locale: string, labels: Labels): string {
  const name = escapeHtml(p.display_name ?? "—");
  const city = escapeHtml(p.city ?? "");
  const rating =
    p.coach_avg_rating != null
      ? `<span class="text-amber-600 font-semibold">★ ${p.coach_avg_rating.toFixed(2)}</span>
         <span class="text-xs text-gray-500 ml-1">${escapeHtml(
           labels.reviews_count.replace("{count}", String(p.coach_reviews_count)),
         )}</span>`
      : `<span class="text-xs text-gray-500">${escapeHtml(labels.no_reviews)}</span>`;
  const rate =
    p.coach_hourly_rate_pln != null
      ? `<div class="text-xs text-gray-600 mt-1">${escapeHtml(
          labels.hourly_rate.replace(
            "{amount}",
            String(p.coach_hourly_rate_pln),
          ),
        )}</div>`
      : "";
  const avatar = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" alt="" style="width:36px;height:36px;border-radius:9999px;object-fit:cover;" />`
    : `<div style="width:36px;height:36px;border-radius:9999px;background:#dcfce7;display:flex;align-items:center;justify-content:center;font-weight:600;color:#166534;">${escapeHtml(name.slice(0, 1).toUpperCase())}</div>`;

  return `
    <div style="font-family:inherit;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${avatar}
        <div>
          <div style="font-weight:600;color:#0f172a;">${name}</div>
          ${city ? `<div style="font-size:11px;color:#64748b;">${city}</div>` : ""}
        </div>
      </div>
      <div style="margin-top:6px;font-size:13px;">${rating}</div>
      ${rate}
      <a href="/${escapeHtml(locale)}/coaches/${escapeHtml(p.id)}" style="display:inline-block;margin-top:8px;background:#22c55e;color:#fff;font-size:12px;font-weight:500;padding:6px 10px;border-radius:8px;text-decoration:none;">${escapeHtml(labels.view_profile)} →</a>
    </div>
  `;
}
