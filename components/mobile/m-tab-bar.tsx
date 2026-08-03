"use client";

import { Link, usePathname } from "@/i18n/routing";
import { Home, LayoutGrid, Trophy, type LucideIcon } from "lucide-react";
import { ScoreboardIcon } from "./m-icons";
import { MPlayFab, type MPlaySheetLabels } from "./m-play-sheet";

// =============================================================================
// Bottom tab bar (design «PlayTennis Navigation»): 5 slots —
// Главная · Турниры · Играть (raised lime FAB, opens an action-sheet) ·
// Матчи · Ещё. Bar: rgba(255,255,255,.9) + blur(16px), hairline top border.
// Active tab: brand-green icon + label + lime glow dot underneath
// (the brand's signature accent). Inactive: #9AAB9F.
//
// «Ещё» is a real screen (/m/more) with the mini-profile and every other
// destination grouped. The same bar is injected on regular web pages inside
// the native shell (native-tab-bar.tsx), so active-tab matching covers both
// /m/* and the web equivalents (/tournaments, /clubs, ...).
// =============================================================================

export type MTab = "feed" | "tournaments" | "play" | "matches" | "more";

type Props = {
  labels: Record<MTab, string>;
  playLabels: MPlaySheetLabels;
  authed: boolean;
};

type TabDef = {
  id: Exclude<MTab, "play">;
  href: string;
  icon: LucideIcon | null;
  webPrefixes: string[];
};

const LEFT_TABS: TabDef[] = [
  { id: "feed", href: "/m", icon: Home, webPrefixes: [] },
  {
    id: "tournaments",
    href: "/m/tournaments",
    icon: Trophy,
    webPrefixes: ["/tournaments", "/me/tournaments"],
  },
];

const RIGHT_TABS: TabDef[] = [
  { id: "matches", href: "/m/matches", icon: null, webPrefixes: ["/matches", "/me/matches"] },
  {
    id: "more",
    href: "/m/more",
    icon: LayoutGrid,
    webPrefixes: [
      "/m/clubs",
      "/m/coaches",
      "/m/rating",
      "/m/notifications",
      "/m/settings",
      "/m/profile",
      "/clubs",
      "/me/clubs",
      "/coaches",
      "/players",
      "/venues",
      "/me/bookings",
      "/me/coaches",
      "/me/rating",
      "/me/find",
      "/me/become-coach",
      "/me/profile",
      "/open-matches",
      "/leaderboard",
      "/coach",
      "/admin",
      "/help",
      "/support",
      "/privacy",
    ],
  },
];

function isActive(pathname: string, tab: TabDef): boolean {
  if (tab.href === "/m") {
    if (pathname === "/m" || pathname === "/") return true;
  } else if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
    return true;
  }
  return tab.webPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function TabLink({ tab, label, active }: { tab: TabDef; label: string; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={tab.href as any}
      // Tabs are the hottest navigation paths — prefetch them fully (RSC data
      // included) so switching feels instant; staleTimes keeps it fresh enough.
      prefetch
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
      <span className="font-display text-[10px] font-bold leading-none">{label}</span>
      <span
        aria-hidden
        className={[
          "h-[3px] w-[3px] rounded-full transition-opacity",
          active ? "bg-ball-600 opacity-100 shadow-[0_0_6px_rgba(167,221,60,0.9)]" : "opacity-0",
        ].join(" ")}
      />
    </Link>
  );
}

export function MTabBar({ labels, playLabels, authed }: Props) {
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
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.id} tab={tab} label={labels[tab.id]} active={isActive(pathname, tab)} />
        ))}
        <MPlayFab label={labels.play} labels={playLabels} authed={authed} />
        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.id} tab={tab} label={labels[tab.id]} active={isActive(pathname, tab)} />
        ))}
      </div>
    </nav>
  );
}
