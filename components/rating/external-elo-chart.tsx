"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ExternalEloPoint } from "@/lib/rating/external/history";

type Props = {
  singles: ExternalEloPoint[];
  doubles: ExternalEloPoint[];
  locale: "ru" | "en";
  copy: {
    empty: string;
    not_enough_points: string;
    elo_axis: string;
    delta: string;
    singles_label: string;
    doubles_label: string;
    calibrating_label: string;
    reason_initial: string;
    reason_refresh: string;
    reason_admin: string;
  };
};

type ChartRow = {
  /** Numeric x value for stable axis ordering. Using ms timestamp keeps
   *  multi-series points aligned even when their counts differ. */
  ts: number;
  label: string;
  singles?: number;
  doubles?: number;
  /** Per-series metadata used by the tooltip. */
  metaSingles?: { delta: number; reason: ExternalEloPoint["reason"]; calibrating: boolean };
  metaDoubles?: { delta: number; reason: ExternalEloPoint["reason"]; calibrating: boolean };
};

/**
 * Second rating chart shown next to the internal Elo timeline.
 *
 * Singles and doubles are independent series. Singles is the dominant line
 * (solid green); doubles is dashed cobalt and only rendered if there is more
 * than one point.
 *
 * Empty / one-point states are handled with an inline empty card so the
 * chart container never collapses to 0 px.
 */
export function ExternalEloChart({
  singles,
  doubles,
  locale,
  copy,
}: Props) {
  const [showDoubles, setShowDoubles] = useState(true);

  const data = useMemo(() => buildSeries(singles, doubles, locale), [
    singles,
    doubles,
    locale,
  ]);

  if (singles.length === 0 && doubles.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl2 border border-dashed border-ink-200 bg-ink-50/50 px-4 text-center text-sm text-ink-500">
        {copy.empty}
      </div>
    );
  }
  if (singles.length < 2 && doubles.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl2 border border-dashed border-ink-200 bg-ink-50/50 px-4 text-center text-sm text-ink-500">
        {copy.not_enough_points}
      </div>
    );
  }

  const allElos = data.flatMap((d) => [
    d.singles ?? Number.POSITIVE_INFINITY,
    d.doubles ?? Number.POSITIVE_INFINITY,
  ]).filter((n) => Number.isFinite(n));
  const minE = allElos.length > 0 ? Math.min(...allElos) : 0;
  const maxE = allElos.length > 0 ? Math.max(...allElos) : 0;
  const pad = Math.max(20, Math.round((maxE - minE) * 0.15));
  const yMin = Math.floor((minE - pad) / 10) * 10;
  const yMax = Math.ceil((maxE + pad) / 10) * 10;

  const reasonLabel = (r: ExternalEloPoint["reason"]) =>
    ({
      initial_import: copy.reason_initial,
      manual_refresh: copy.reason_refresh,
      admin_set: copy.reason_admin,
    })[r];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="label"
            stroke="#7a8a86"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#dde2e0" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke="#7a8a86"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#dde2e0" }}
            width={48}
            label={{
              value: copy.elo_axis,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#7a8a86" },
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0].payload as ChartRow;
              return (
                <div className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs shadow-card">
                  <div className="font-semibold text-ink-900">{row.label}</div>
                  {row.singles != null && (
                    <SeriesLine
                      label={copy.singles_label}
                      elo={row.singles}
                      meta={row.metaSingles}
                      colorClass="text-grass-700"
                      copy={copy}
                      reasonLabel={reasonLabel}
                    />
                  )}
                  {row.doubles != null && (
                    <SeriesLine
                      label={copy.doubles_label}
                      elo={row.doubles}
                      meta={row.metaDoubles}
                      colorClass="text-hard-cobalt"
                      copy={copy}
                      reasonLabel={reasonLabel}
                    />
                  )}
                </div>
              );
            }}
          />
          {doubles.length >= 1 && (
            <Legend
              verticalAlign="top"
              height={28}
              iconSize={10}
              wrapperStyle={{ fontSize: 11 }}
              onClick={(e) => {
                if (typeof e.value === "string" && e.value === copy.doubles_label) {
                  setShowDoubles((v) => !v);
                }
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="singles"
            name={copy.singles_label}
            stroke="#187341"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#187341", stroke: "white", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
          {doubles.length >= 1 && showDoubles && (
            <Line
              type="monotone"
              dataKey="doubles"
              name={copy.doubles_label}
              stroke="#0E5BD8"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: "#0E5BD8", stroke: "white", strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildSeries(
  singles: ExternalEloPoint[],
  doubles: ExternalEloPoint[],
  locale: "ru" | "en",
): ChartRow[] {
  const fmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  const map = new Map<number, ChartRow>();

  const upsert = (point: ExternalEloPoint) => {
    const ts = Date.parse(point.created_at);
    const existing = map.get(ts);
    const row: ChartRow = existing ?? {
      ts,
      label: fmt.format(new Date(ts)),
    };
    if (point.discipline === "singles") {
      row.singles = point.new_elo;
      row.metaSingles = {
        delta: point.delta,
        reason: point.reason,
        calibrating: point.is_calibrating,
      };
    } else {
      row.doubles = point.new_elo;
      row.metaDoubles = {
        delta: point.delta,
        reason: point.reason,
        calibrating: point.is_calibrating,
      };
    }
    map.set(ts, row);
  };

  for (const p of singles) upsert(p);
  for (const p of doubles) upsert(p);

  return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
}

function SeriesLine({
  label,
  elo,
  meta,
  colorClass,
  copy,
  reasonLabel,
}: {
  label: string;
  elo: number;
  meta: ChartRow["metaSingles"];
  colorClass: string;
  copy: Props["copy"];
  reasonLabel: (r: ExternalEloPoint["reason"]) => string;
}) {
  const positive = (meta?.delta ?? 0) >= 0;
  return (
    <div className="mt-1.5">
      <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink-500">
        {label}
        {meta?.calibrating && (
          <span className="ml-1 text-ball-700">· {copy.calibrating_label}</span>
        )}
      </div>
      <div className={["mt-0.5 font-mono text-base font-bold", colorClass].join(" ")}>
        {elo}
      </div>
      {meta && meta.delta !== 0 && (
        <div className={positive ? "text-grass-700" : "text-clay-700"}>
          {positive ? "+" : ""}
          {meta.delta} {copy.delta}
        </div>
      )}
      {meta && (
        <div className="mt-0.5 text-ink-500">{reasonLabel(meta.reason)}</div>
      )}
    </div>
  );
}
