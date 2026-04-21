"use client";

import { Link } from "@/i18n/routing";

export type LeaderboardTabsCopy = {
  tab_mine: string;
  tab_all: string;
};

export function LeaderboardTabs({
  active,
  totalMine,
  totalAll,
  copy,
}: {
  active: "mine" | "all";
  totalMine: number;
  totalAll: number;
  copy: LeaderboardTabsCopy;
}) {
  return (
    <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1 shadow-card">
      <Tab
        active={active === "mine"}
        href="/coach/leaderboard?scope=mine"
        label={copy.tab_mine}
        count={totalMine}
      />
      <Tab
        active={active === "all"}
        href="/coach/leaderboard?scope=all"
        label={copy.tab_all}
        count={totalAll}
      />
    </div>
  );
}

function Tab({
  active,
  href,
  label,
  count,
}: {
  active: boolean;
  href: string;
  label: string;
  count: number;
}) {
  const cls = active
    ? "bg-grass-500 text-white shadow-card"
    : "text-ink-600 hover:bg-ink-50";
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={href as any}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${cls}`}
    >
      {label}{" "}
      <span
        className={
          "ml-1 rounded-full px-1.5 text-[10px] " +
          (active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-700")
        }
      >
        {count}
      </span>
    </Link>
  );
}
