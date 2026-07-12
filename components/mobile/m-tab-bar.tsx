"use client";

import { Link, usePathname } from "@/i18n/routing";
import { Home, Trophy, Users, UserRound } from "lucide-react";
import { ScoreboardIcon } from "./m-icons";

// =============================================================================
// Bottom tab bar (ТЗ §5 «Таб-бар»): rgba(255,255,255,.9) + blur(16px),
// border-top rgba(20,60,30,.07), 9px top / 26px bottom (safe-area) padding.
// 5 flex:1 items: 23px icon + 10px/700 label, gap 3px.
// Active #1C7A46, inactive #9AAB9F.
// =============================================================================

export type MTab = "feed" | "tournaments" | "matches" | "clubs" | "profile";

type Props = {
  labels: Record<MTab, string>;
};

const TABS: Array<{ id: MTab; href: string }> = [
  { id: "feed", href: "/m" },
  { id: "tournaments", href: "/m/tournaments" },
  { id: "matches", href: "/m/matches" },
  { id: "clubs", href: "/m/clubs" },
  { id: "profile", href: "/m/profile" },
];

export function MTabBar({ labels }: Props) {
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
          const active =
            tab.href === "/m"
              ? pathname === "/m"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon =
            tab.id === "feed"
              ? Home
              : tab.id === "tournaments"
                ? Trophy
                : tab.id === "clubs"
                  ? Users
                  : tab.id === "profile"
                    ? UserRound
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
      </div>
    </nav>
  );
}
