"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { EloPoint } from "@/lib/rating/history";

type Props = {
  history: EloPoint[];
  locale: "pl" | "en" | "ru";
  copy: {
    empty: string;
    elo_axis: string;
    delta: string;
    reason_match: string;
    reason_onboarding: string;
    reason_manual: string;
    reason_decay: string;
  };
};

export function EloChart({ history, locale, copy }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-ink-50/50 text-sm text-ink-500">
        {copy.empty}
      </div>
    );
  }

  const data = history.map((p, i) => ({
    idx: i + 1,
    elo: p.new_elo,
    delta: p.delta,
    reason: p.reason,
    label: new Date(p.created_at).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
    }),
  }));

  // Compute a comfortable Y range: Elo ± padding
  const elos = data.map((d) => d.elo);
  const minE = Math.min(...elos);
  const maxE = Math.max(...elos);
  const pad = Math.max(20, Math.round((maxE - minE) * 0.15));
  const yMin = Math.floor((minE - pad) / 10) * 10;
  const yMax = Math.ceil((maxE + pad) / 10) * 10;

  const reasonLabel = (r: EloPoint["reason"]) =>
    ({
      match: copy.reason_match,
      onboarding: copy.reason_onboarding,
      manual_adjustment: copy.reason_manual,
      seasonal_decay: copy.reason_decay,
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
              const p = payload[0].payload as (typeof data)[number];
              const positive = (p.delta ?? 0) >= 0;
              return (
                <div className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs shadow-card">
                  <div className="font-semibold text-ink-900">{p.label}</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-grass-700">
                    {p.elo}
                  </div>
                  <div className={positive ? "text-grass-700" : "text-clay-700"}>
                    {positive ? "+" : ""}
                    {p.delta} {copy.delta}
                  </div>
                  <div className="mt-0.5 text-ink-500">
                    {reasonLabel(p.reason as EloPoint["reason"])}
                  </div>
                </div>
              );
            }}
          />
          {data.length >= 2 && (
            <ReferenceLine
              y={data[0].elo}
              stroke="#c9d2cf"
              strokeDasharray="4 4"
            />
          )}
          <Line
            type="monotone"
            dataKey="elo"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#16a34a", stroke: "white", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
