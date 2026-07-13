"use client";

import { Link, usePathname } from "@/i18n/routing";
import { Home, Trophy, Users } from "lucide-react";
import { ScoreboardIcon } from "./m-icons";
import { MMenuSheet, type MMenuLabels } from "./m-menu-sheet";

// =============================================================================
// Bottom tab bar (ТЗ §5 «Таб-бар»): rgba(255,255,255,.9) + blur(16px),
// border-top rgba(20,60,30,.07), 9px top / 26px bottom (safe-area) padding.
// 5 flex:1 items: 23px icon + 10px/700 label, gap 3px.
// Active #1C7A46, inactive #9AAB9F.
//
// The 5th slot is a burger («Меню») opening a bottom-sheet with every other
// destination (see m-menu-sheet.tsx). The same bar is injected on regular web
// pages inside the native shell (native-tab-bar.tsx), so active-tab matching
// covers both /m/* and the web equivalents (/tournaments, /clubs, ...).
// =============================================================================

export type MTab = "feed" | "tournaments" | "matches" | "clubs" | "menu";

type Props = {
  labels: Record<MTab, string>;
  menuLabels: MMenuLabels;
  authed: boolean;
};

const TABS: Array<{ id: Exclude<MTab, "menu">; href: string; webPrefixes: string[] }> = [
  { id: "feed", href: "/m", webPrefixes: [] },
  { id: "tournaments", href: "/m/tournaments", webPrefixes: ["/tournaments", "/me/tournaments"] },
  { id: "matches", href: "/m/matches", webPrefixes: ["/matches", "/me/matches"] },
  { id: "clubs", href: "/m/clubs", webPrefixes: ["/clubs", "/me/clubs"] },
];

function isActive(pathname: string, tab: (typeof TABS)[number]): boolean {
  if (tab.href === "/m") {
    if (pathname === "/m" || pathname === "/") return true;
  } else if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
    return true;
  }
  return tab.webPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function MTabBar({ labels, menuLabels, authed }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile app navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(20,60,30,0.07)] bg-white/90 backdrop-blur-[16px]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[430px] px-[10px] pt-[9px]">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon =
            tab.id === "feed"
              ? Home
              : tab.id === "tournaments"
                ? Trophy
                : tab.id === "clubs"
                  ? Users
                  : null;
          return (
            <Link
              key={tab.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={tab.href as any}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-1 flex-col items-center justify-center gap-[3px] pb-1 pt-0.5 transition-opacity duration-150 active:opacity-85",
                active ? "text-grass-600" : "text-[#9AAB9F]",
              ].join(" ")}
            >
              {Icon ? (
                <Icon className="h-[23px] w-[23px]" strokeWidth={1.8} />
              ) : (
                <ScoreboardIcon className="h-[23px] w-[23px]" />
              )}
              <span className="font-display text-[10px] font-bold leading-none">
                {labels[tab.id]}
              </span>
            </Link>
          );
        })}
        <MMenuSheet label={labels.menu} labels={menuLabels} authed={authed} />
      </div>
    </nav>
  );
}
